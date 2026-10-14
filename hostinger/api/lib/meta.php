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
    return rtrim(config()['base_url'], '/') . '/api/index.php?action=meta_callback';
}

function meta_login_url(string $state): string
{
    return 'https://www.facebook.com/' . config()['graph_version'] . '/dialog/oauth?' . http_build_query([
        'client_id' => config()['meta_app_id'],
        'redirect_uri' => meta_redirect_uri(),
        'state' => $state,
        'scope' => implode(',', META_SCOPES),
        'response_type' => 'code',
    ]);
}

/** Exchanges the OAuth code and stores every Page (and its linked Instagram account). Returns count. */
function meta_handle_callback(string $code): int
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
        'fields' => 'id,name,access_token,instagram_business_account{id,username}',
        'limit' => 100,
        'access_token' => $long['access_token'],
    ]);

    $upsert = db()->prepare('INSERT INTO accounts (network, external_id, name, handle, access_token, connected_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(network, external_id) DO UPDATE SET name = excluded.name, handle = excluded.handle, access_token = excluded.access_token');
    $count = 0;
    foreach ($pages['data'] ?? [] as $page) {
        $upsert->execute(['facebook', $page['id'], $page['name'], $page['id'], $page['access_token'], now_iso()]);
        $count++;
        $ig = $page['instagram_business_account'] ?? null;
        if ($ig) {
            $upsert->execute(['instagram', $ig['id'], $ig['username'] ?? $page['name'], $ig['username'] ?? '', $page['access_token'], now_iso()]);
            $count++;
        }
    }
    return $count;
}

/** Publishes to one account. Returns the network's post id. */
function meta_publish(array $account, string $text, array $media): string
{
    $token = $account['access_token'];
    $id = $account['external_id'];

    if ($account['network'] === 'facebook') {
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
        if (count($media) === 0) {
            throw new RuntimeException('Instagram needs at least one image.');
        }
        if (count($media) === 1) {
            $container = graph('POST', "$id/media", ['image_url' => $media[0], 'caption' => $text, 'access_token' => $token]);
        } else {
            $children = [];
            foreach (array_slice($media, 0, 10) as $url) {
                $children[] = graph('POST', "$id/media", ['image_url' => $url, 'is_carousel_item' => 'true', 'access_token' => $token])['id'];
            }
            $container = graph('POST', "$id/media", [
                'media_type' => 'CAROUSEL',
                'children' => implode(',', $children),
                'caption' => $text,
                'access_token' => $token,
            ]);
        }
        // Wait until Instagram has processed the media (usually instant for images).
        for ($i = 0; $i < 10; $i++) {
            $s = graph('GET', $container['id'], ['fields' => 'status_code', 'access_token' => $token]);
            if (($s['status_code'] ?? 'FINISHED') === 'FINISHED') {
                break;
            }
            if (($s['status_code'] ?? '') === 'ERROR') {
                throw new RuntimeException('Instagram could not process the image.');
            }
            sleep(2);
        }
        return graph('POST', "$id/media_publish", ['creation_id' => $container['id'], 'access_token' => $token])['id'];
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
        $a = $pdo->prepare('SELECT * FROM accounts WHERE id = ?');
        $a->execute([$aid]);
        $account = $a->fetch();
        if (!$account) {
            $results[$aid] = ['ok' => false, 'error' => 'Account no longer connected'];
            continue;
        }
        try {
            $results[$aid] = ['ok' => true, 'id' => meta_publish($account, $post['text'], $media)];
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
