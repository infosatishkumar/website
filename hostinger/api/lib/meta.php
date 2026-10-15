<?php
declare(strict_types=1);

/* Meta Graph API: Facebook Login, Page + Instagram Business publishing. */

const META_SCOPES = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'business_management',
    'instagram_basic',
    'instagram_content_publish',
];

function graph_url(string $path): string
{
    return 'https://graph.facebook.com/' . config()['graph_version'] . '/' . ltrim($path, '/');
}

/** Calls the Graph API and returns decoded JSON, throwing with Meta's own error message. */
function graph(string $method, string $path, array $params = []): array
{
    $ch = curl_init();
    $url = graph_url($path);
    if ($method === 'GET') {
        $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($params);
    } else {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    }
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        throw new RuntimeException('Could not reach Meta: ' . $err);
    }
    $data = json_decode((string) $raw, true) ?: [];
    if (isset($data['error'])) {
        throw new RuntimeException('Meta: ' . ($data['error']['error_user_msg'] ?? $data['error']['message'] ?? 'unknown error'));
    }
    return $data;
}

function meta_redirect_uri(): string
{
    return oauth_redirect_uri();
}

function meta_login_url(string $state): string
{
    $params = [
        'client_id' => config()['meta_app_id'],
        'redirect_uri' => meta_redirect_uri(),
        'state' => $state,
        'response_type' => 'code',
    ];
    // "Facebook Login for Business" apps pick permissions from a saved configuration.
    $configId = trim((string) (config()['meta_config_id'] ?? ''));
    if ($configId !== '') {
        $params['config_id'] = $configId;
        $params['override_default_response_type'] = 'true';
    } else {
        $params['scope'] = implode(',', META_SCOPES);
    }
    return 'https://www.facebook.com/' . config()['graph_version'] . '/dialog/oauth?' . http_build_query($params);
}

/**
 * Exchanges the OAuth code and keeps the Pages / Instagram accounts it can manage
 * as "pending" for the current user, so they can pick which ones to connect.
 */
function meta_handle_callback(string $code, string $kind): int
{
    $cfg = config();
    $short = graph('GET', 'oauth/access_token', [
        'client_id' => $cfg['meta_app_id'],
        'client_secret' => $cfg['meta_app_secret'],
        'redirect_uri' => meta_redirect_uri(),
        'code' => $code,
    ]);
    // Long-lived user token → page tokens derived from it don't expire.
    $long = graph('GET', 'oauth/access_token', [
        'grant_type' => 'fb_exchange_token',
        'client_id' => $cfg['meta_app_id'],
        'client_secret' => $cfg['meta_app_secret'],
        'fb_exchange_token' => $short['access_token'],
    ]);
    $pages = graph('GET', 'me/accounts', [
        'fields' => 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
        'limit' => 100,
        'access_token' => $long['access_token'],
    ]);

    $items = [];
    foreach ($pages['data'] ?? [] as $page) {
        if ($kind !== 'instagram') {
            $items[] = ['key' => 'facebook:' . $page['id'], 'network' => 'facebook', 'external_id' => $page['id'], 'name' => $page['name'],
                'handle' => $page['id'], 'picture' => $page['picture']['data']['url'] ?? '', 'token' => $page['access_token']];
        }
        $ig = $page['instagram_business_account'] ?? null;
        if ($ig && $kind !== 'facebook') {
            $items[] = ['key' => 'instagram:' . $ig['id'], 'network' => 'instagram', 'external_id' => $ig['id'], 'name' => $ig['username'] ?? $page['name'],
                'handle' => $ig['username'] ?? '', 'picture' => $ig['profile_picture_url'] ?? '', 'token' => $page['access_token'], 'via' => $page['name']];
        }
    }
    db()->prepare('INSERT INTO pending_accounts (user_id, kind, data, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, data = excluded.data, created_at = excluded.created_at')
        ->execute([uid(), $kind, json_encode($items), time()]);
    return count($items);
}

/** Pending accounts for the picker (without tokens). */
function meta_pending(): array
{
    $s = db()->prepare('SELECT * FROM pending_accounts WHERE user_id = ? AND created_at > ?');
    $s->execute([uid(), time() - 3600]);
    $row = $s->fetch();
    if (!$row) {
        return ['kind' => '', 'items' => []];
    }
    $connected = db()->prepare('SELECT network || char(58) || external_id FROM accounts WHERE user_id = ?');
    $connected->execute([uid()]);
    $have = array_flip($connected->fetchAll(PDO::FETCH_COLUMN));
    $items = array_map(fn ($i) => [
        'key' => $i['key'], 'network' => $i['network'], 'name' => $i['name'], 'handle' => $i['handle'],
        'picture' => $i['picture'], 'via' => $i['via'] ?? ($i['meta']['via'] ?? ''), 'connected' => isset($have[$i['key']]),
    ], json_decode($row['data'], true) ?: []);
    return ['kind' => $row['kind'], 'items' => $items];
}

/** Connects the chosen pending accounts. Returns how many were added or refreshed. */
function meta_connect_selected(array $keys): int
{
    $s = db()->prepare('SELECT data FROM pending_accounts WHERE user_id = ?');
    $s->execute([uid()]);
    $items = json_decode((string) $s->fetchColumn(), true) ?: [];
    $want = array_flip(array_map('strval', $keys));
    $upsert = db()->prepare('INSERT INTO accounts (user_id, network, external_id, name, handle, access_token, refresh_token, expires_at, meta, connected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(network, external_id) DO UPDATE SET user_id = excluded.user_id, name = excluded.name, handle = excluded.handle,
            access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, meta = excluded.meta');
    $n = 0;
    foreach ($items as $i) {
        if (isset($want[$i['key']])) {
            $upsert->execute([uid(), $i['network'], $i['external_id'], $i['name'], $i['handle'], $i['token'],
                (string) ($i['refresh'] ?? ''), (int) ($i['expires'] ?? 0), json_encode($i['meta'] ?? new stdClass()), now_iso()]);
            $n++;
        }
    }
    return $n;
}

/** Publishes to one account. Returns the network's post id. */
function meta_publish(array $account, string $text, array $media): string
{
    $token = $account['access_token'];
    $id = $account['external_id'];

    $videos = array_values(array_filter($media, 'is_video_url'));
    $images = array_values(array_filter($media, fn ($m) => !is_video_url($m)));

    if ($account['network'] === 'facebook') {
        if ($videos) {
            $r = graph('POST', "$id/videos", ['file_url' => $videos[0], 'description' => $text, 'access_token' => $token]);
            return (string) ($r['id'] ?? 'ok');
        }
        $media = $images;
        if (count($media) === 0) {
            return graph('POST', "$id/feed", ['message' => $text, 'access_token' => $token])['id'];
        }
        if (count($media) === 1) {
            $r = graph('POST', "$id/photos", ['url' => $media[0], 'caption' => $text, 'access_token' => $token]);
            return $r['post_id'] ?? $r['id'];
        }
        $attached = [];
        foreach ($media as $url) {
            $photo = graph('POST', "$id/photos", ['url' => $url, 'published' => 'false', 'access_token' => $token]);
            $attached[] = json_encode(['media_fbid' => $photo['id']]);
        }
        $params = ['message' => $text, 'access_token' => $token];
        foreach ($attached as $i => $a) {
            $params["attached_media[$i]"] = $a;
        }
        return graph('POST', "$id/feed", $params)['id'];
    }

    if ($account['network'] === 'instagram') {
        return container_publish('Instagram', 'https://graph.facebook.com/' . config()['graph_version'], $id, $token, $images, $videos, $text, 'caption', 'media_publish');
    }

    throw new RuntimeException('Publishing to ' . $account['network'] . ' is not supported yet.');
}

/** Publishes a stored post to all its accounts and records the outcome. */
function publish_post(int $postId): array
{
    $pdo = db();
    // Claim the post so cron and "publish now" can't both send it.
    $claim = $pdo->prepare("UPDATE posts SET status = 'publishing' WHERE id = ? AND status IN ('scheduled', 'draft', 'pending', 'failed')");
    $claim->execute([$postId]);
    if ($claim->rowCount() === 0) {
        throw new RuntimeException('Post is already published or being published.');
    }
    $s = $pdo->prepare('SELECT * FROM posts WHERE id = ?');
    $s->execute([$postId]);
    $post = $s->fetch();

    $ids = json_decode($post['account_ids'], true) ?: [];
    $media = json_decode($post['media'], true) ?: [];
    $results = [];
    $ok = 0;
    foreach ($ids as $aid) {
        $a = $pdo->prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?');
        $a->execute([$aid, $post['user_id']]);
        $account = $a->fetch();
        if (!$account) {
            $results[$aid] = ['ok' => false, 'error' => 'Account no longer connected'];
            continue;
        }
        try {
            $results[$aid] = ['ok' => true, 'id' => network_publish($account, $post['text'], $media)];
            $ok++;
        } catch (Throwable $e) {
            $results[$aid] = ['ok' => false, 'error' => $e->getMessage()];
        }
    }
    $status = $ok > 0 ? 'published' : 'failed';
    $pdo->prepare('UPDATE posts SET status = ?, result = ?, scheduled_at = CASE WHEN ? = ? THEN ? ELSE scheduled_at END WHERE id = ?')
        ->execute([$status, json_encode($results), $status, 'published', now_iso(), $postId]);
    $s->execute([$postId]);
    return $s->fetch();
}
