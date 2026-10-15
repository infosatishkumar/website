<?php
declare(strict_types=1);

/*
 * Every network besides the Meta Graph flow in meta.php: OAuth login, account lists
 * for the picker, token refresh and publishing.
 *
 * All networks share one callback URL: https://yourdomain.com/api/oauth.php
 */

/** What each "Connect …" button logs in to. */
const CONNECT_KINDS = [
    'facebook' => ['network' => 'facebook', 'provider' => 'meta'],
    'instagram' => ['network' => 'instagram', 'provider' => 'meta'],
    'instagram_login' => ['network' => 'instagram', 'provider' => 'instagram'],
    'threads' => ['network' => 'threads', 'provider' => 'threads'],
    'linkedin_profile' => ['network' => 'linkedin', 'provider' => 'linkedin'],
    'linkedin_page' => ['network' => 'linkedin', 'provider' => 'linkedin_page'],
    'x' => ['network' => 'x', 'provider' => 'x'],
    'youtube' => ['network' => 'youtube', 'provider' => 'google'],
    'google_business' => ['network' => 'google', 'provider' => 'google'],
    'pinterest' => ['network' => 'pinterest', 'provider' => 'pinterest'],
    'tiktok' => ['network' => 'tiktok', 'provider' => 'tiktok'],
];

/** Developer-app keys per provider (saved from Platform settings). */
const PROVIDER_KEYS = [
    'meta' => ['meta_app_id', 'meta_app_secret'],
    'instagram' => ['instagram_app_id', 'instagram_app_secret'],
    'threads' => ['threads_app_id', 'threads_app_secret'],
    'linkedin' => ['linkedin_client_id', 'linkedin_client_secret'],
    'linkedin_page' => ['linkedin_page_client_id', 'linkedin_page_client_secret'],
    'x' => ['x_client_id', 'x_client_secret'],
    'google' => ['google_client_id', 'google_client_secret'],
    'pinterest' => ['pinterest_app_id', 'pinterest_app_secret'],
    'tiktok' => ['tiktok_client_key', 'tiktok_client_secret'],
];

function oauth_redirect_uri(): string
{
    return base_url() . '/api/oauth.php';
}

function provider_ready(string $provider): bool
{
    $cfg = config();
    foreach (PROVIDER_KEYS[$provider] ?? [] as $k) {
        if (trim((string) ($cfg[$k] ?? '')) === '') {
            return false;
        }
    }
    return isset(PROVIDER_KEYS[$provider]);
}

/** LinkedIn Pages can use their own app (Community Management API); otherwise the main LinkedIn app. */
function linkedin_keys(bool $page): array
{
    $cfg = config();
    if ($page && trim((string) ($cfg['linkedin_page_client_id'] ?? '')) !== '' && trim((string) ($cfg['linkedin_page_client_secret'] ?? '')) !== '') {
        return [(string) $cfg['linkedin_page_client_id'], (string) $cfg['linkedin_page_client_secret']];
    }
    return [(string) ($cfg['linkedin_client_id'] ?? ''), (string) ($cfg['linkedin_client_secret'] ?? '')];
}

/** Which connect buttons work right now (Bluesky needs no developer app). */
function connect_ready(): array
{
    $out = ['bluesky' => true];
    foreach (CONNECT_KINDS as $kind => $k) {
        $out[$kind] = provider_ready($k['provider']);
    }
    $out['linkedin_page'] = $out['linkedin_page'] || provider_ready('linkedin');
    return $out;
}

/* ---------------- HTTP ---------------- */

/**
 * Small cURL wrapper. Options: form, json, body, headers, basic => [user, pass], multipart, file (PUT a local file).
 * Returns ['status', 'data' (decoded JSON or null), 'raw', 'headers' (lower-case)].
 */
function http_req(string $method, string $url, array $o = []): array
{
    // Local tests only: SMC_TEST_HTTP=http://127.0.0.1:port routes every call to a fake server.
    $mock = getenv('SMC_TEST_HTTP');
    if ($mock) {
        $url = rtrim($mock, '/') . '/' . preg_replace('#^https?://#', '', $url);
    }
    $ch = curl_init($url);
    $headers = $o['headers'] ?? [];
    $respHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$respHeaders) {
            $p = strpos($line, ':');
            if ($p !== false) {
                $respHeaders[strtolower(trim(substr($line, 0, $p)))] = trim(substr($line, $p + 1));
            }
            return strlen($line);
        },
    ]);
    if (isset($o['form'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($o['form']));
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    } elseif (isset($o['json'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($o['json'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $headers[] = 'Content-Type: application/json';
    } elseif (isset($o['multipart'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $o['multipart']);
    } elseif (isset($o['body'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $o['body']);
    } elseif (isset($o['file'])) {
        $fh = fopen($o['file'], 'rb');
        curl_setopt_array($ch, [CURLOPT_UPLOAD => true, CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => filesize($o['file'])]);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    }
    if (isset($o['basic'])) {
        curl_setopt($ch, CURLOPT_USERPWD, $o['basic'][0] . ':' . $o['basic'][1]);
    }
    if ($headers) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (isset($fh)) {
        fclose($fh);
    }
    if ($raw === false) {
        throw new RuntimeException('Network error: ' . $err);
    }
    $data = json_decode((string) $raw, true);
    return ['status' => $status, 'data' => is_array($data) ? $data : null, 'raw' => (string) $raw, 'headers' => $respHeaders];
}

/** Like http_req but throws "<Network>: message" on any non-2xx reply. */
function api(string $label, string $method, string $url, array $o = []): array
{
    $r = http_req($method, $url, $o);
    if ($r['status'] >= 200 && $r['status'] < 300) {
        return $r;
    }
    $d = $r['data'] ?? [];
    $msg = $d['error_description'] ?? $d['error']['message'] ?? $d['error']['error_user_msg'] ?? $d['message'] ?? $d['detail']
        ?? $d['errors'][0]['message'] ?? $d['error']['code'] ?? $d['title'] ?? (is_string($d['error'] ?? null) ? $d['error'] : null)
        ?? ('HTTP ' . $r['status'] . ' ' . substr(strip_tags($r['raw']), 0, 160));
    throw new RuntimeException("$label: $msg");
}

function bearer(string $token): array
{
    return ['Authorization: Bearer ' . $token];
}

/* ---------------- OAuth ---------------- */

function oauth_pkce(): array
{
    $verifier = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    return [$verifier, $challenge];
}

/** Builds the login URL for a connect button and remembers the state in the session. */
function oauth_start(string $kind): string
{
    if (!isset(CONNECT_KINDS[$kind])) {
        throw new RuntimeException('Unknown network');
    }
    $provider = CONNECT_KINDS[$kind]['provider'];
    if (!(connect_ready()[$kind] ?? false)) {
        throw new RuntimeException('This network is not set up yet. The site owner can add its app keys in Settings → Platform settings.');
    }
    $cfg = config();
    $state = bin2hex(random_bytes(16));
    $entry = ['kind' => $kind, 't' => time()];
    $redirect = oauth_redirect_uri();

    switch ($provider) {
        case 'meta':
            $url = meta_login_url($state);
            break;
        case 'instagram':
            $url = 'https://www.instagram.com/oauth/authorize?' . http_build_query([
                'client_id' => $cfg['instagram_app_id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'state' => $state,
                'scope' => 'instagram_business_basic,instagram_business_content_publish', 'enable_fb_login' => '0', 'force_authentication' => '1',
            ]);
            break;
        case 'threads':
            $url = 'https://threads.net/oauth/authorize?' . http_build_query([
                'client_id' => $cfg['threads_app_id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'state' => $state,
                'scope' => 'threads_basic,threads_content_publish',
            ]);
            break;
        case 'linkedin':
        case 'linkedin_page':
            $scope = $kind === 'linkedin_page' ? 'r_organization_admin w_organization_social' : 'openid profile w_member_social';
            $url = 'https://www.linkedin.com/oauth/v2/authorization?' . http_build_query([
                'response_type' => 'code', 'client_id' => linkedin_keys($kind === 'linkedin_page')[0], 'redirect_uri' => $redirect, 'state' => $state, 'scope' => $scope,
            ]);
            break;
        case 'x':
            [$verifier, $challenge] = oauth_pkce();
            $entry['verifier'] = $verifier;
            $url = 'https://x.com/i/oauth2/authorize?' . http_build_query([
                'response_type' => 'code', 'client_id' => $cfg['x_client_id'], 'redirect_uri' => $redirect, 'state' => $state,
                'scope' => 'tweet.read tweet.write users.read media.write offline.access', 'code_challenge' => $challenge, 'code_challenge_method' => 'S256',
            ]);
            break;
        case 'google':
            $scope = $kind === 'youtube'
                ? 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
                : 'https://www.googleapis.com/auth/business.manage';
            $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
                'client_id' => $cfg['google_client_id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'state' => $state,
                'scope' => $scope, 'access_type' => 'offline', 'prompt' => 'consent', 'include_granted_scopes' => 'true',
            ]);
            break;
        case 'pinterest':
            $url = 'https://www.pinterest.com/oauth/?' . http_build_query([
                'client_id' => $cfg['pinterest_app_id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'state' => $state,
                'scope' => 'boards:read,pins:read,pins:write,user_accounts:read',
            ]);
            break;
        case 'tiktok':
            $url = 'https://www.tiktok.com/v2/auth/authorize/?' . http_build_query([
                'client_key' => $cfg['tiktok_client_key'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'state' => $state,
                'scope' => 'user.info.basic,video.publish',
            ]);
            break;
        default:
            throw new RuntimeException('Unknown network');
    }

    start_session();
    $all = array_filter((array) ($_SESSION['oauth'] ?? []), fn ($e) => ($e['t'] ?? 0) > time() - 1800);
    $all[$state] = $entry;
    $_SESSION['oauth'] = $all;
    return $url;
}

/** Handles the provider redirect; returns the URL to send the browser to. */
function oauth_callback(array $q): string
{
    $back = base_url() . '/connector/app/accounts/create/';
    start_session();
    $state = (string) ($q['state'] ?? '');
    $entry = $_SESSION['oauth'][$state] ?? null;
    if ($state === '' || !$entry) {
        return $back . '?error=' . rawurlencode('Login expired, please try again.');
    }
    unset($_SESSION['oauth'][$state]);
    if (!empty($q['error']) || empty($q['code'])) {
        $why = (string) ($q['error_description'] ?? $q['error_message'] ?? $q['error'] ?? 'Connection cancelled');
        return $back . '?error=' . rawurlencode($why);
    }
    $kind = $entry['kind'];
    try {
        $code = (string) $q['code'];
        if (CONNECT_KINDS[$kind]['provider'] === 'meta') {
            meta_handle_callback($code, $kind);
        } else {
            save_pending($kind, oauth_accounts($kind, $code, $entry));
        }
    } catch (Throwable $e) {
        error_log("SMC connect error ($kind): " . $e->getMessage());
        return $back . '?error=' . rawurlencode($e->getMessage());
    }
    return base_url() . '/connector/app/accounts/select/';
}

/** Exchanges the code and lists the accounts the person can post to. */
function oauth_accounts(string $kind, string $code, array $entry): array
{
    $cfg = config();
    $redirect = oauth_redirect_uri();
    $items = [];
    $item = fn (string $network, string $id, string $name, string $handle, string $picture, string $token, string $refresh = '', int $expires = 0, array $meta = []) => [
        'key' => "$network:$id", 'network' => $network, 'external_id' => $id, 'name' => $name !== '' ? $name : $handle, 'handle' => $handle,
        'picture' => $picture, 'token' => $token, 'refresh' => $refresh, 'expires' => $expires, 'meta' => $meta,
    ];

    switch (CONNECT_KINDS[$kind]['provider']) {
        case 'instagram':
            $t = api('Instagram', 'POST', 'https://api.instagram.com/oauth/access_token', ['form' => [
                'client_id' => $cfg['instagram_app_id'], 'client_secret' => $cfg['instagram_app_secret'],
                'grant_type' => 'authorization_code', 'redirect_uri' => $redirect, 'code' => $code,
            ]])['data'];
            $long = api('Instagram', 'GET', 'https://graph.instagram.com/access_token?' . http_build_query([
                'grant_type' => 'ig_exchange_token', 'client_secret' => $cfg['instagram_app_secret'], 'access_token' => $t['access_token'],
            ]))['data'];
            $me = api('Instagram', 'GET', 'https://graph.instagram.com/' . $cfg['graph_version'] . '/me?' . http_build_query([
                'fields' => 'user_id,username,name,profile_picture_url', 'access_token' => $long['access_token'],
            ]))['data'];
            $items[] = $item('instagram', (string) ($me['user_id'] ?? $me['id']), (string) ($me['name'] ?? ''), (string) ($me['username'] ?? ''),
                (string) ($me['profile_picture_url'] ?? ''), $long['access_token'], '', time() + (int) ($long['expires_in'] ?? 5184000), ['api' => 'instagram']);
            break;

        case 'threads':
            $t = api('Threads', 'POST', 'https://graph.threads.net/oauth/access_token', ['form' => [
                'client_id' => $cfg['threads_app_id'], 'client_secret' => $cfg['threads_app_secret'],
                'grant_type' => 'authorization_code', 'redirect_uri' => $redirect, 'code' => $code,
            ]])['data'];
            $long = api('Threads', 'GET', 'https://graph.threads.net/access_token?' . http_build_query([
                'grant_type' => 'th_exchange_token', 'client_secret' => $cfg['threads_app_secret'], 'access_token' => $t['access_token'],
            ]))['data'];
            $me = api('Threads', 'GET', 'https://graph.threads.net/v1.0/me?' . http_build_query([
                'fields' => 'id,username,name,threads_profile_picture_url', 'access_token' => $long['access_token'],
            ]))['data'];
            $items[] = $item('threads', (string) $me['id'], (string) ($me['name'] ?? ''), (string) ($me['username'] ?? ''),
                (string) ($me['threads_profile_picture_url'] ?? ''), $long['access_token'], '', time() + (int) ($long['expires_in'] ?? 5184000));
            break;

        case 'linkedin':
        case 'linkedin_page':
            [$liId, $liSecret] = linkedin_keys($kind === 'linkedin_page');
            $t = api('LinkedIn', 'POST', 'https://www.linkedin.com/oauth/v2/accessToken', ['form' => [
                'grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect,
                'client_id' => $liId, 'client_secret' => $liSecret,
            ]])['data'];
            $token = $t['access_token'];
            $refresh = (string) ($t['refresh_token'] ?? '');
            $expires = time() + (int) ($t['expires_in'] ?? 5184000);
            if ($kind === 'linkedin_page') {
                $acl = api('LinkedIn', 'GET', 'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=100',
                    ['headers' => linkedin_headers($token)])['data'];
                $seen = [];
                foreach ($acl['elements'] ?? [] as $el) {
                    // Admins and content admins may post as the Page.
                    if (!in_array($el['role'] ?? '', ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR', 'CURATOR'], true) || isset($seen[$el['organization']])) {
                        continue;
                    }
                    $seen[$el['organization']] = true;
                    $urn = (string) $el['organization'];
                    $orgId = substr($urn, strrpos($urn, ':') + 1);
                    $org = http_req('GET', "https://api.linkedin.com/rest/organizations/$orgId", ['headers' => linkedin_headers($token)])['data'] ?? [];
                    $items[] = $item('linkedin', $urn, (string) ($org['localizedName'] ?? "Page $orgId"), (string) ($org['vanityName'] ?? ''), '', $token, $refresh, $expires, ['app' => 'page']);
                }
            } else {
                $me = api('LinkedIn', 'GET', 'https://api.linkedin.com/v2/userinfo', ['headers' => bearer($token)])['data'];
                $items[] = $item('linkedin', 'urn:li:person:' . $me['sub'], (string) ($me['name'] ?? ''), '', (string) ($me['picture'] ?? ''), $token, $refresh, $expires);
            }
            break;

        case 'x':
            $t = api('X', 'POST', 'https://api.x.com/2/oauth2/token', [
                'form' => ['code' => $code, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirect, 'code_verifier' => $entry['verifier'] ?? '', 'client_id' => $cfg['x_client_id']],
                'basic' => [$cfg['x_client_id'], $cfg['x_client_secret']],
            ])['data'];
            $me = api('X', 'GET', 'https://api.x.com/2/users/me?user.fields=profile_image_url', ['headers' => bearer($t['access_token'])])['data']['data'];
            $items[] = $item('x', (string) $me['id'], (string) ($me['name'] ?? ''), (string) ($me['username'] ?? ''), (string) ($me['profile_image_url'] ?? ''),
                $t['access_token'], (string) ($t['refresh_token'] ?? ''), time() + (int) ($t['expires_in'] ?? 7200));
            break;

        case 'google':
            $t = api('Google', 'POST', 'https://oauth2.googleapis.com/token', ['form' => [
                'code' => $code, 'client_id' => $cfg['google_client_id'], 'client_secret' => $cfg['google_client_secret'],
                'redirect_uri' => $redirect, 'grant_type' => 'authorization_code',
            ]])['data'];
            $token = $t['access_token'];
            $refresh = (string) ($t['refresh_token'] ?? '');
            $expires = time() + (int) ($t['expires_in'] ?? 3600);
            if ($kind === 'youtube') {
                $ch = api('YouTube', 'GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', ['headers' => bearer($token)])['data'];
                foreach ($ch['items'] ?? [] as $c) {
                    $items[] = $item('youtube', (string) $c['id'], (string) $c['snippet']['title'], (string) ($c['snippet']['customUrl'] ?? ''),
                        (string) ($c['snippet']['thumbnails']['default']['url'] ?? ''), $token, $refresh, $expires);
                }
            } else {
                $accounts = api('Google Business', 'GET', 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts', ['headers' => bearer($token)])['data'];
                foreach ($accounts['accounts'] ?? [] as $acc) {
                    $locs = api('Google Business', 'GET', 'https://mybusinessbusinessinformation.googleapis.com/v1/' . $acc['name']
                        . '/locations?readMask=name,title&pageSize=100', ['headers' => bearer($token)])['data'];
                    foreach ($locs['locations'] ?? [] as $loc) {
                        $items[] = $item('google', $acc['name'] . '/' . $loc['name'], (string) ($loc['title'] ?? $loc['name']), '', '', $token, $refresh, $expires,
                            ['via' => (string) ($acc['accountName'] ?? '')]);
                    }
                }
            }
            break;

        case 'pinterest':
            $t = api('Pinterest', 'POST', 'https://api.pinterest.com/v5/oauth/token', [
                'form' => ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect],
                'basic' => [$cfg['pinterest_app_id'], $cfg['pinterest_app_secret']],
            ])['data'];
            $token = $t['access_token'];
            $user = http_req('GET', 'https://api.pinterest.com/v5/user_account', ['headers' => bearer($token)])['data'] ?? [];
            $boards = api('Pinterest', 'GET', 'https://api.pinterest.com/v5/boards?page_size=100', ['headers' => bearer($token)])['data'];
            foreach ($boards['items'] ?? [] as $b) {
                $items[] = $item('pinterest', (string) $b['id'], (string) $b['name'], (string) ($user['username'] ?? ''), (string) ($user['profile_image'] ?? ''),
                    $token, (string) ($t['refresh_token'] ?? ''), time() + (int) ($t['expires_in'] ?? 2592000), ['via' => (string) ($user['username'] ?? '')]);
            }
            break;

        case 'tiktok':
            $t = api('TikTok', 'POST', 'https://open.tiktokapis.com/v2/oauth/token/', ['form' => [
                'client_key' => $cfg['tiktok_client_key'], 'client_secret' => $cfg['tiktok_client_secret'],
                'code' => $code, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirect,
            ]])['data'];
            if (empty($t['access_token'])) {
                throw new RuntimeException('TikTok: ' . ($t['error_description'] ?? 'login failed'));
            }
            $u = http_req('GET', 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username', ['headers' => bearer($t['access_token'])])['data']['data']['user'] ?? [];
            $items[] = $item('tiktok', (string) ($t['open_id'] ?? $u['open_id']), (string) ($u['display_name'] ?? 'TikTok'), (string) ($u['username'] ?? ''),
                (string) ($u['avatar_url'] ?? ''), $t['access_token'], (string) ($t['refresh_token'] ?? ''), time() + (int) ($t['expires_in'] ?? 86400));
            break;
    }
    return $items;
}

function save_pending(string $kind, array $items): void
{
    db()->prepare('INSERT INTO pending_accounts (user_id, kind, data, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, data = excluded.data, created_at = excluded.created_at')
        ->execute([uid(), $kind, json_encode($items), time()]);
}

/** Bluesky: handle + app password, no developer app needed. Connects straight away. */
function bluesky_connect(string $handle, string $appPassword): array
{
    $handle = ltrim(trim($handle), '@');
    if ($handle === '' || trim($appPassword) === '') {
        fail('Enter your Bluesky handle and an app password');
    }
    $s = bluesky_session($handle, trim($appPassword));
    $profile = http_req('GET', 'https://bsky.social/xrpc/app.bsky.actor.getProfile?actor=' . rawurlencode($s['did']), ['headers' => bearer($s['accessJwt'])])['data'] ?? [];
    save_pending('bluesky', [[
        'key' => 'bluesky:' . $s['did'], 'network' => 'bluesky', 'external_id' => $s['did'], 'name' => (string) ($profile['displayName'] ?? $s['handle']),
        'handle' => (string) $s['handle'], 'picture' => (string) ($profile['avatar'] ?? ''), 'token' => trim($appPassword), 'refresh' => '', 'expires' => 0, 'meta' => ['identifier' => $handle],
    ]]);
    return ['ok' => true];
}

function bluesky_session(string $identifier, string $password): array
{
    return api('Bluesky', 'POST', 'https://bsky.social/xrpc/com.atproto.server.createSession', ['json' => ['identifier' => $identifier, 'password' => $password]])['data'];
}

/* ---------------- tokens ---------------- */

function account_meta(array $account): array
{
    return json_decode((string) ($account['meta'] ?? '{}'), true) ?: [];
}

/** Returns a usable access token, refreshing it first when it is about to expire. */
function account_token(array &$account): string
{
    $exp = (int) ($account['expires_at'] ?? 0);
    if ($exp === 0 || $exp > time() + 300) {
        return (string) $account['access_token'];
    }
    $cfg = config();
    $refresh = (string) ($account['refresh_token'] ?? '');
    $new = null;
    switch ($account['network']) {
        case 'instagram':
            $new = api('Instagram', 'GET', 'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' . rawurlencode($account['access_token']))['data'];
            break;
        case 'threads':
            $new = api('Threads', 'GET', 'https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=' . rawurlencode($account['access_token']))['data'];
            break;
        case 'x':
            $new = api('X', 'POST', 'https://api.x.com/2/oauth2/token', [
                'form' => ['refresh_token' => $refresh, 'grant_type' => 'refresh_token', 'client_id' => $cfg['x_client_id']],
                'basic' => [$cfg['x_client_id'], $cfg['x_client_secret']],
            ])['data'];
            break;
        case 'youtube':
        case 'google':
            $new = api('Google', 'POST', 'https://oauth2.googleapis.com/token', ['form' => [
                'refresh_token' => $refresh, 'client_id' => $cfg['google_client_id'], 'client_secret' => $cfg['google_client_secret'], 'grant_type' => 'refresh_token',
            ]])['data'];
            break;
        case 'pinterest':
            $new = api('Pinterest', 'POST', 'https://api.pinterest.com/v5/oauth/token', [
                'form' => ['grant_type' => 'refresh_token', 'refresh_token' => $refresh], 'basic' => [$cfg['pinterest_app_id'], $cfg['pinterest_app_secret']],
            ])['data'];
            break;
        case 'tiktok':
            $new = api('TikTok', 'POST', 'https://open.tiktokapis.com/v2/oauth/token/', ['form' => [
                'client_key' => $cfg['tiktok_client_key'], 'client_secret' => $cfg['tiktok_client_secret'], 'grant_type' => 'refresh_token', 'refresh_token' => $refresh,
            ]])['data'];
            break;
        case 'linkedin':
            if ($refresh === '') {
                throw new RuntimeException('LinkedIn: the login expired — reconnect this account.');
            }
            [$liId, $liSecret] = linkedin_keys((account_meta($account)['app'] ?? '') === 'page');
            $new = api('LinkedIn', 'POST', 'https://www.linkedin.com/oauth/v2/accessToken', ['form' => [
                'grant_type' => 'refresh_token', 'refresh_token' => $refresh, 'client_id' => $liId, 'client_secret' => $liSecret,
            ]])['data'];
            break;
        default:
            return (string) $account['access_token'];
    }
    if (empty($new['access_token'])) {
        throw new RuntimeException(ucfirst($account['network']) . ': could not refresh the login — reconnect this account.');
    }
    $token = (string) $new['access_token'];
    $newRefresh = (string) ($new['refresh_token'] ?? $refresh);
    $newExp = time() + (int) ($new['expires_in'] ?? 3600);
    // Accounts from the same login (e.g. several boards or locations) share the token.
    db()->prepare("UPDATE accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE network = ? AND user_id = ? AND (id = ? OR (refresh_token <> '' AND refresh_token = ?))")
        ->execute([$token, $newRefresh, $newExp, $account['network'], $account['user_id'], $account['id'], $refresh]);
    $account['access_token'] = $token;
    $account['refresh_token'] = $newRefresh;
    $account['expires_at'] = $newExp;
    return $token;
}

/* ---------------- media helpers ---------------- */

function is_video_url(string $url): bool
{
    return (bool) preg_match('/\.(mp4|mov|m4v|webm)(\?|$)/i', $url);
}

/** Local path for one of our uploads, or a temp download for any other URL. */
function media_file(string $url): string
{
    $prefix = base_url() . '/uploads/';
    if (str_starts_with($url, $prefix)) {
        $path = dirname(__DIR__, 2) . '/uploads/' . basename(substr($url, strlen($prefix)));
        if (is_file($path)) {
            return $path;
        }
    }
    $tmp = tempnam(sys_get_temp_dir(), 'smc');
    $r = http_req('GET', $url);
    if ($r['status'] !== 200) {
        throw new RuntimeException('Could not read the media file');
    }
    file_put_contents($tmp, $r['raw']);
    return $tmp;
}

function media_mime(string $path): string
{
    return (string) (mime_content_type($path) ?: 'application/octet-stream');
}

/* ---------------- publishing ---------------- */

/** Publishes one post to one account on any network. Returns the network's post id. */
function network_publish(array $account, string $text, array $media): string
{
    $images = array_values(array_filter($media, fn ($m) => !is_video_url($m)));
    $videos = array_values(array_filter($media, 'is_video_url'));
    $meta = account_meta($account);

    switch ($account['network']) {
        case 'facebook':
        case 'instagram':
            if (($meta['api'] ?? '') === 'instagram') {
                return instagram_login_publish($account, $text, $images, $videos);
            }
            return meta_publish($account, $text, $media);
        case 'threads':
            return threads_publish($account, $text, $images, $videos);
        case 'linkedin':
            return linkedin_publish($account, $text, $images);
        case 'x':
            return x_publish($account, $text, $images);
        case 'youtube':
            return youtube_publish($account, $text, $videos);
        case 'google':
            return gbp_publish($account, $text, $images);
        case 'pinterest':
            return pinterest_publish($account, $text, $images);
        case 'tiktok':
            return tiktok_publish($account, $text, $images, $videos);
        case 'bluesky':
            return bluesky_publish($account, $text, $images);
    }
    throw new RuntimeException('Publishing to ' . $account['network'] . ' is not supported.');
}

/** Container → wait → publish, shared by Instagram Login and Threads. */
function container_publish(string $label, string $base, string $id, string $token, array $images, array $videos, string $text, string $textKey, string $publishPath): string
{
    $post = fn (string $path, array $p) => api($label, 'POST', "$base/$path", ['form' => $p + ['access_token' => $token]])['data'];
    $field = $label === 'Threads' ? 'status' : 'status_code';
    $wait = function (string $cid) use ($label, $base, $token, $field) {
        for ($i = 0; $i < 40; $i++) {
            $s = api($label, 'GET', "$base/$cid?fields=$field&access_token=" . rawurlencode($token))['data'];
            $code = $s['status_code'] ?? ($s['status'] ?? 'FINISHED');
            if ($code === 'FINISHED' || $code === 'PUBLISHED') {
                return;
            }
            if ($code === 'ERROR' || $code === 'EXPIRED') {
                throw new RuntimeException("$label could not process the media.");
            }
            sleep(3);
        }
    };
    $isThreads = $label === 'Threads';
    $items = array_merge(array_map(fn ($u) => ['image', $u], $images), array_map(fn ($u) => ['video', $u], $videos));
    if (!$items) {
        if (!$isThreads) {
            throw new RuntimeException("$label needs at least one image or video.");
        }
        $c = $post("$id/threads", ['media_type' => 'TEXT', 'text' => $text]);
    } elseif (count($items) === 1) {
        [$type, $url] = $items[0];
        $p = $type === 'image' ? ['image_url' => $url] : ['video_url' => $url, 'media_type' => $isThreads ? 'VIDEO' : 'REELS'];
        if ($isThreads && $type === 'image') {
            $p['media_type'] = 'IMAGE';
        }
        $c = $post($isThreads ? "$id/threads" : "$id/media", $p + [$textKey => $text]);
    } else {
        $children = [];
        foreach (array_slice($items, 0, 10) as [$type, $url]) {
            $p = $type === 'image' ? ['image_url' => $url, 'media_type' => 'IMAGE'] : ['video_url' => $url, 'media_type' => 'VIDEO'];
            if (!$isThreads && $type === 'image') {
                unset($p['media_type']);
            }
            $cid = $post($isThreads ? "$id/threads" : "$id/media", $p + ['is_carousel_item' => 'true'])['id'];
            $wait($cid);
            $children[] = $cid;
        }
        $c = $post($isThreads ? "$id/threads" : "$id/media", ['media_type' => 'CAROUSEL', 'children' => implode(',', $children), $textKey => $text]);
    }
    $wait($c['id']);
    return (string) $post("$id/$publishPath", ['creation_id' => $c['id']])['id'];
}

function instagram_login_publish(array $account, string $text, array $images, array $videos): string
{
    $token = account_token($account);
    return container_publish('Instagram', 'https://graph.instagram.com/' . config()['graph_version'], $account['external_id'], $token, $images, $videos, $text, 'caption', 'media_publish');
}

function threads_publish(array $account, string $text, array $images, array $videos): string
{
    $token = account_token($account);
    return container_publish('Threads', 'https://graph.threads.net/v1.0', $account['external_id'], $token, $images, $videos, $text, 'text', 'threads_publish');
}

function linkedin_headers(string $token): array
{
    // LinkedIn retires API versions after ~1 year, so default to two months back from today.
    $version = trim((string) (config()['linkedin_version'] ?? '')) ?: gmdate('Ym', strtotime('first day of -2 months'));
    return array_merge(bearer($token), ['LinkedIn-Version: ' . $version, 'X-Restli-Protocol-Version: 2.0.0']);
}

function linkedin_publish(array $account, string $text, array $images): string
{
    $token = account_token($account);
    $author = $account['external_id'];
    $body = [
        'author' => $author,
        'commentary' => $text,
        'visibility' => 'PUBLIC',
        'distribution' => ['feedDistribution' => 'MAIN_FEED', 'targetEntities' => [], 'thirdPartyDistributionChannels' => []],
        'lifecycleState' => 'PUBLISHED',
        'isReshareDisabledByAuthor' => false,
    ];
    $ids = [];
    foreach (array_slice($images, 0, 9) as $url) {
        $init = api('LinkedIn', 'POST', 'https://api.linkedin.com/rest/images?action=initializeUpload', [
            'headers' => linkedin_headers($token), 'json' => ['initializeUploadRequest' => ['owner' => $author]],
        ])['data']['value'];
        api('LinkedIn', 'PUT', $init['uploadUrl'], ['headers' => bearer($token), 'file' => media_file($url)]);
        $ids[] = $init['image'];
    }
    if (count($ids) === 1) {
        $body['content'] = ['media' => ['id' => $ids[0]]];
    } elseif (count($ids) > 1) {
        $body['content'] = ['multiImage' => ['images' => array_map(fn ($i) => ['id' => $i], $ids)]];
    }
    $r = api('LinkedIn', 'POST', 'https://api.linkedin.com/rest/posts', ['headers' => linkedin_headers($token), 'json' => $body]);
    return (string) ($r['headers']['x-restli-id'] ?? $r['headers']['x-linkedin-id'] ?? 'ok');
}

function x_publish(array $account, string $text, array $images): string
{
    $token = account_token($account);
    $mediaIds = [];
    foreach (array_slice($images, 0, 4) as $url) {
        $path = media_file($url);
        $r = api('X', 'POST', 'https://api.x.com/2/media/upload', [
            'headers' => bearer($token),
            'multipart' => ['media' => new CURLFile($path, media_mime($path)), 'media_category' => 'tweet_image'],
        ])['data'];
        $mediaIds[] = (string) ($r['data']['id'] ?? $r['id'] ?? $r['media_id_string'] ?? '');
    }
    $body = ['text' => $text];
    if ($mediaIds) {
        $body['media'] = ['media_ids' => $mediaIds];
    }
    return (string) api('X', 'POST', 'https://api.x.com/2/tweets', ['headers' => bearer($token), 'json' => $body])['data']['data']['id'];
}

function youtube_publish(array $account, string $text, array $videos): string
{
    if (!$videos) {
        throw new RuntimeException('YouTube needs a video. Attach an MP4 file.');
    }
    $token = account_token($account);
    $path = media_file($videos[0]);
    $lines = preg_split('/\R/', trim($text)) ?: [''];
    $title = mb_substr(trim($lines[0]) !== '' ? trim($lines[0]) : 'New video', 0, 100);
    $start = api('YouTube', 'POST', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', [
        'headers' => array_merge(bearer($token), ['X-Upload-Content-Type: ' . media_mime($path), 'X-Upload-Content-Length: ' . filesize($path)]),
        'json' => ['snippet' => ['title' => $title, 'description' => mb_substr($text, 0, 5000)], 'status' => ['privacyStatus' => 'public', 'selfDeclaredMadeForKids' => false]],
    ]);
    $upload = $start['headers']['location'] ?? '';
    if ($upload === '') {
        throw new RuntimeException('YouTube did not accept the upload.');
    }
    $r = api('YouTube', 'PUT', $upload, ['headers' => array_merge(bearer($token), ['Content-Type: ' . media_mime($path)]), 'file' => $path]);
    return (string) ($r['data']['id'] ?? 'ok');
}

function gbp_publish(array $account, string $text, array $images): string
{
    $token = account_token($account);
    $body = ['languageCode' => 'en', 'summary' => mb_substr($text, 0, 1500), 'topicType' => 'STANDARD'];
    if ($images) {
        $body['media'] = [['mediaFormat' => 'PHOTO', 'sourceUrl' => $images[0]]];
    }
    $r = api('Google Business', 'POST', 'https://mybusiness.googleapis.com/v4/' . $account['external_id'] . '/localPosts', ['headers' => bearer($token), 'json' => $body]);
    return (string) ($r['data']['name'] ?? 'ok');
}

function pinterest_publish(array $account, string $text, array $images): string
{
    if (!$images) {
        throw new RuntimeException('Pinterest needs an image.');
    }
    $token = account_token($account);
    $lines = preg_split('/\R/', trim($text)) ?: [''];
    $body = [
        'board_id' => $account['external_id'],
        'title' => mb_substr(trim($lines[0]), 0, 100),
        'description' => mb_substr($text, 0, 500),
        'media_source' => count($images) > 1
            ? ['source_type' => 'multiple_image_urls', 'items' => array_map(fn ($u) => ['url' => $u], array_slice($images, 0, 5))]
            : ['source_type' => 'image_url', 'url' => $images[0]],
    ];
    return (string) api('Pinterest', 'POST', 'https://api.pinterest.com/v5/pins', ['headers' => bearer($token), 'json' => $body])['data']['id'];
}

function tiktok_publish(array $account, string $text, array $images, array $videos): string
{
    if (!$images && !$videos) {
        throw new RuntimeException('TikTok needs a video or photos.');
    }
    $token = account_token($account);
    $info = api('TikTok', 'POST', 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/', ['headers' => bearer($token), 'json' => new stdClass()])['data']['data'] ?? [];
    $options = (array) ($info['privacy_level_options'] ?? []);
    $privacy = in_array('PUBLIC_TO_EVERYONE', $options, true) ? 'PUBLIC_TO_EVERYONE' : ($options[0] ?? 'SELF_ONLY');
    if ($videos) {
        $r = api('TikTok', 'POST', 'https://open.tiktokapis.com/v2/post/publish/video/init/', ['headers' => bearer($token), 'json' => [
            'post_info' => ['title' => mb_substr($text, 0, 2200), 'privacy_level' => $privacy],
            'source_info' => ['source' => 'PULL_FROM_URL', 'video_url' => $videos[0]],
        ]])['data'];
    } else {
        $r = api('TikTok', 'POST', 'https://open.tiktokapis.com/v2/post/publish/content/init/', ['headers' => bearer($token), 'json' => [
            'post_info' => ['title' => mb_substr($text, 0, 90), 'description' => mb_substr($text, 0, 4000), 'privacy_level' => $privacy],
            'source_info' => ['source' => 'PULL_FROM_URL', 'photo_images' => array_slice($images, 0, 35), 'photo_cover_index' => 0],
            'post_mode' => 'DIRECT_POST',
            'media_type' => 'PHOTO',
        ]])['data'];
    }
    if (($r['error']['code'] ?? 'ok') !== 'ok') {
        throw new RuntimeException('TikTok: ' . ($r['error']['message'] ?? $r['error']['code']));
    }
    return (string) ($r['data']['publish_id'] ?? 'ok');
}

function bluesky_publish(array $account, string $text, array $images): string
{
    $meta = account_meta($account);
    $s = bluesky_session((string) ($meta['identifier'] ?? $account['handle']), (string) $account['access_token']);
    $record = ['$type' => 'app.bsky.feed.post', 'text' => mb_substr($text, 0, 300), 'createdAt' => gmdate('Y-m-d\TH:i:s.000\Z')];
    // Clickable links.
    $facets = [];
    if (preg_match_all('#https?://[^\s]+#u', $record['text'], $m, PREG_OFFSET_CAPTURE)) {
        foreach ($m[0] as [$url, $start]) {
            $facets[] = ['index' => ['byteStart' => $start, 'byteEnd' => $start + strlen($url)],
                'features' => [['$type' => 'app.bsky.richtext.facet#link', 'uri' => $url]]];
        }
    }
    if ($facets) {
        $record['facets'] = $facets;
    }
    $blobs = [];
    foreach (array_slice($images, 0, 4) as $url) {
        $path = media_file($url);
        $b = api('Bluesky', 'POST', 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob', [
            'headers' => array_merge(bearer($s['accessJwt']), ['Content-Type: ' . media_mime($path)]), 'body' => file_get_contents($path),
        ])['data'];
        $blobs[] = ['alt' => '', 'image' => $b['blob']];
    }
    if ($blobs) {
        $record['embed'] = ['$type' => 'app.bsky.embed.images', 'images' => $blobs];
    }
    $r = api('Bluesky', 'POST', 'https://bsky.social/xrpc/com.atproto.repo.createRecord', [
        'headers' => bearer($s['accessJwt']), 'json' => ['repo' => $s['did'], 'collection' => 'app.bsky.feed.post', 'record' => $record],
    ])['data'];
    return (string) ($r['uri'] ?? 'ok');
}
