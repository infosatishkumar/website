<?php
// OAuth flows per social platform: authorize URL, code exchange, refresh.
declare(strict_types=1);

const FF_GRAPH = 'v26.0';
const FF_LINKEDIN_VERSION = '202608';

const FF_SCOPES = [
    'meta' => ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
    'instagram' => ['instagram_business_basic', 'instagram_business_content_publish'],
    'threads' => ['threads_basic', 'threads_content_publish'],
    'linkedin' => ['openid', 'profile', 'w_member_social'],
    'x' => ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    'google' => ['openid', 'email', 'https://www.googleapis.com/auth/spreadsheets'],
    'pinterest' => ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'],
];

function ff_is_provider(string $p): bool { return isset(FF_SCOPES[$p]); }

function ff_provider_creds(string $p): ?array {
    $o = ff_config()['oauth'][$p] ?? null;
    return ($o && !empty($o['id']) && !empty($o['secret'])) ? $o : null;
}

// One callback URL for every platform; the provider is recovered from the OAuth state.
function ff_redirect_uri(string $p): string { return ff_app_url() . '/oauth.php'; }

function ff_scope_string(string $p): string {
    return implode(in_array($p, ['meta', 'instagram', 'threads', 'pinterest'], true) ? ',' : ' ', FF_SCOPES[$p]);
}

function ff_expiry($seconds): ?int { return is_numeric($seconds) && $seconds > 0 ? time() + (int) $seconds : null; }

function ff_basic(array $c): array { return ['Authorization: Basic ' . base64_encode($c['id'] . ':' . $c['secret'])]; }

function ff_get_json(string $what, string $url, array $q = [], array $headers = []): array {
    return ff_api($what, 'GET', $url . ($q ? '?' . http_build_query($q) : ''), $headers);
}

function ff_authorize_url(string $p, array $c, string $state, string $challenge): string {
    $redirect = ff_redirect_uri($p);
    $scope = ff_scope_string($p);
    $q = fn(string $base, array $params) => $base . '?' . http_build_query($params);
    switch ($p) {
        case 'meta':
            return $q('https://www.facebook.com/' . FF_GRAPH . '/dialog/oauth', ['client_id' => $c['id'], 'redirect_uri' => $redirect, 'state' => $state, 'scope' => $scope, 'response_type' => 'code']);
        case 'instagram':
            return $q('https://www.instagram.com/oauth/authorize', ['client_id' => $c['id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'scope' => $scope, 'state' => $state]);
        case 'threads':
            return $q('https://threads.net/oauth/authorize', ['client_id' => $c['id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'scope' => $scope, 'state' => $state]);
        case 'linkedin':
            return $q('https://www.linkedin.com/oauth/v2/authorization', ['response_type' => 'code', 'client_id' => $c['id'], 'redirect_uri' => $redirect, 'state' => $state, 'scope' => $scope]);
        case 'x':
            return $q('https://x.com/i/oauth2/authorize', ['response_type' => 'code', 'client_id' => $c['id'], 'redirect_uri' => $redirect, 'scope' => $scope, 'state' => $state, 'code_challenge' => $challenge, 'code_challenge_method' => 'S256']);
        case 'google':
            return $q('https://accounts.google.com/o/oauth2/v2/auth', ['client_id' => $c['id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'scope' => $scope, 'state' => $state, 'access_type' => 'offline', 'prompt' => 'consent', 'include_granted_scopes' => 'true']);
        case 'pinterest':
            return $q('https://www.pinterest.com/oauth/', ['client_id' => $c['id'], 'redirect_uri' => $redirect, 'response_type' => 'code', 'scope' => $scope, 'state' => $state]);
    }
    throw new RuntimeException('Unknown provider');
}

/** Exchanges the code; returns [label, secret, meta, expiresAt]. */
function ff_oauth_finish(string $p, array $c, string $code, string $verifier): array {
    $redirect = ff_redirect_uri($p);
    switch ($p) {
        case 'meta': {
            $g = 'https://graph.facebook.com/' . FF_GRAPH;
            $short = ff_get_json('Facebook token exchange', "$g/oauth/access_token", ['client_id' => $c['id'], 'client_secret' => $c['secret'], 'redirect_uri' => $redirect, 'code' => $code]);
            $long = ff_get_json('Facebook long-lived token', "$g/oauth/access_token", ['grant_type' => 'fb_exchange_token', 'client_id' => $c['id'], 'client_secret' => $c['secret'], 'fb_exchange_token' => $short['access_token']]);
            $token = $long['access_token'];
            $me = ff_get_json('Facebook profile', "$g/me", ['fields' => 'id,name', 'access_token' => $token]);
            $acc = ff_get_json('Facebook pages', "$g/me/accounts", ['fields' => 'id,name,access_token', 'limit' => 100, 'access_token' => $token]);
            $pages = $acc['data'] ?? [];
            if (!$pages) throw new RuntimeException('No Facebook Pages were shared. Reconnect and select at least one Page.');
            $tokens = [];
            foreach ($pages as $pg) $tokens[$pg['id']] = $pg['access_token'];
            return [
                $me['name'] . ' · ' . count($pages) . ' page' . (count($pages) > 1 ? 's' : ''),
                ['userToken' => $token, 'pageTokens' => $tokens],
                ['pages' => array_map(fn($pg) => ['id' => $pg['id'], 'name' => $pg['name']], $pages)],
                null,
            ];
        }
        case 'instagram': {
            $short = ff_form_post('Instagram token exchange', 'https://api.instagram.com/oauth/access_token', ['client_id' => $c['id'], 'client_secret' => $c['secret'], 'grant_type' => 'authorization_code', 'redirect_uri' => $redirect, 'code' => preg_replace('/#_$/', '', $code)]);
            $first = isset($short['data'][0]) ? $short['data'][0] : $short;
            $long = ff_get_json('Instagram long-lived token', 'https://graph.instagram.com/access_token', ['grant_type' => 'ig_exchange_token', 'client_secret' => $c['secret'], 'access_token' => $first['access_token']]);
            $me = ff_get_json('Instagram profile', 'https://graph.instagram.com/me', ['fields' => 'user_id,username', 'access_token' => $long['access_token']]);
            return ['@' . $me['username'], ['accessToken' => $long['access_token'], 'userId' => (string) ($me['user_id'] ?? $first['user_id'])], null, ff_expiry($long['expires_in'] ?? null)];
        }
        case 'threads': {
            $short = ff_form_post('Threads token exchange', 'https://graph.threads.net/oauth/access_token', ['client_id' => $c['id'], 'client_secret' => $c['secret'], 'grant_type' => 'authorization_code', 'redirect_uri' => $redirect, 'code' => $code]);
            $long = ff_get_json('Threads long-lived token', 'https://graph.threads.net/access_token', ['grant_type' => 'th_exchange_token', 'client_secret' => $c['secret'], 'access_token' => $short['access_token']]);
            $me = ff_get_json('Threads profile', 'https://graph.threads.net/v1.0/me', ['fields' => 'id,username', 'access_token' => $long['access_token']]);
            return ['@' . $me['username'], ['accessToken' => $long['access_token'], 'userId' => (string) $me['id']], null, ff_expiry($long['expires_in'] ?? null)];
        }
        case 'linkedin': {
            $t = ff_form_post('LinkedIn token exchange', 'https://www.linkedin.com/oauth/v2/accessToken', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect, 'client_id' => $c['id'], 'client_secret' => $c['secret']]);
            $me = ff_get_json('LinkedIn profile', 'https://api.linkedin.com/v2/userinfo', [], ['Authorization: Bearer ' . $t['access_token']]);
            return [$me['name'] ?? 'LinkedIn member', ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? null, 'personUrn' => 'urn:li:person:' . $me['sub']], null, ff_expiry($t['expires_in'] ?? null)];
        }
        case 'x': {
            $t = ff_form_post('X token exchange', 'https://api.x.com/2/oauth2/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect, 'code_verifier' => $verifier, 'client_id' => $c['id']], ff_basic($c));
            $me = ff_get_json('X profile', 'https://api.x.com/2/users/me', [], ['Authorization: Bearer ' . $t['access_token']]);
            return ['@' . $me['data']['username'], ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? null], null, ff_expiry($t['expires_in'] ?? null)];
        }
        case 'google': {
            $t = ff_form_post('Google token exchange', 'https://oauth2.googleapis.com/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect, 'client_id' => $c['id'], 'client_secret' => $c['secret']]);
            $me = ff_get_json('Google profile', 'https://openidconnect.googleapis.com/v1/userinfo', [], ['Authorization: Bearer ' . $t['access_token']]);
            return [$me['email'] ?? 'Google account', ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? null], null, ff_expiry($t['expires_in'] ?? null)];
        }
        case 'pinterest': {
            $t = ff_form_post('Pinterest token exchange', 'https://api.pinterest.com/v5/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirect], ff_basic($c));
            $auth = ['Authorization: Bearer ' . $t['access_token']];
            $me = ff_get_json('Pinterest profile', 'https://api.pinterest.com/v5/user_account', [], $auth);
            $boards = ff_get_json('Pinterest boards', 'https://api.pinterest.com/v5/boards', ['page_size' => 100], $auth);
            return ['@' . $me['username'], ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? null], ['boards' => array_map(fn($b) => ['id' => $b['id'], 'name' => $b['name']], $boards['items'] ?? [])], ff_expiry($t['expires_in'] ?? null)];
        }
    }
    throw new RuntimeException('Unknown provider');
}

/** Refreshes tokens; returns [secret, expiresAt] or null if the provider can't refresh. */
function ff_oauth_refresh(string $p, array $c, array $s): ?array {
    switch ($p) {
        case 'instagram':
            $r = ff_get_json('Instagram token refresh', 'https://graph.instagram.com/refresh_access_token', ['grant_type' => 'ig_refresh_token', 'access_token' => $s['accessToken']]);
            return [array_merge($s, ['accessToken' => $r['access_token']]), ff_expiry($r['expires_in'] ?? null)];
        case 'threads':
            $r = ff_get_json('Threads token refresh', 'https://graph.threads.net/refresh_access_token', ['grant_type' => 'th_refresh_token', 'access_token' => $s['accessToken']]);
            return [array_merge($s, ['accessToken' => $r['access_token']]), ff_expiry($r['expires_in'] ?? null)];
        case 'linkedin':
            if (empty($s['refreshToken'])) return null;
            $t = ff_form_post('LinkedIn token refresh', 'https://www.linkedin.com/oauth/v2/accessToken', ['grant_type' => 'refresh_token', 'refresh_token' => $s['refreshToken'], 'client_id' => $c['id'], 'client_secret' => $c['secret']]);
            return [array_merge($s, ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? $s['refreshToken']]), ff_expiry($t['expires_in'] ?? null)];
        case 'x':
            $t = ff_form_post('X token refresh', 'https://api.x.com/2/oauth2/token', ['grant_type' => 'refresh_token', 'refresh_token' => $s['refreshToken'], 'client_id' => $c['id']], ff_basic($c));
            return [['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? $s['refreshToken']], ff_expiry($t['expires_in'] ?? null)];
        case 'google':
            $t = ff_form_post('Google token refresh', 'https://oauth2.googleapis.com/token', ['grant_type' => 'refresh_token', 'refresh_token' => $s['refreshToken'], 'client_id' => $c['id'], 'client_secret' => $c['secret']]);
            return [array_merge($s, ['accessToken' => $t['access_token']]), ff_expiry($t['expires_in'] ?? null)];
        case 'pinterest':
            $t = ff_form_post('Pinterest token refresh', 'https://api.pinterest.com/v5/oauth/token', ['grant_type' => 'refresh_token', 'refresh_token' => $s['refreshToken']], ff_basic($c));
            return [array_merge($s, ['accessToken' => $t['access_token'], 'refreshToken' => $t['refresh_token'] ?? $s['refreshToken']]), ff_expiry($t['expires_in'] ?? null)];
    }
    return null;
}
