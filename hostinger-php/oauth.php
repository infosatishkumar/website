<?php
// OAuth start + callback: oauth.php?start=1&provider=x&app=x  →  platform  →  oauth.php?code=…&state=…
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

function ff_back(string $key, string $msg): void {
    header('Location: ' . ff_app_url() . '/?page=integrations&' . $key . '=' . rawurlencode($msg));
    exit;
}

if (!ff_authed()) { header('Location: ' . ff_app_url() . '/'); exit; }
if (isset($_GET['start'])) {
    $p = (string) ($_GET['provider'] ?? '');
    if (!ff_is_provider($p)) ff_back('error', 'Unknown provider');
    $creds = ff_provider_creds($p);
    if (!$creds) ff_back('error', 'Add the ' . $p . ' app ID and secret in Setup first.');
    $state = ff_token(24);
    $verifier = ff_token(48);
    $challenge = ff_b64(hash('sha256', $verifier, true));
    $app = (string) ($_GET['app'] ?? '');
    ff_update('kv', function ($kv) use ($state, $p, $app, $verifier) {
        foreach ($kv['oauth'] ?? [] as $k => $v) if (time() - $v['created'] > 900) unset($kv['oauth'][$k]);
        $kv['oauth'][$state] = ['provider' => $p, 'app' => $app, 'verifier' => $verifier, 'created' => time()];
        return $kv;
    });
    header('Location: ' . ff_authorize_url($p, $creds, $state, $challenge));
    exit;
}

if (!empty($_GET['error'])) ff_back('error', (string) ($_GET['error_description'] ?? $_GET['error']));
$state = (string) ($_GET['state'] ?? '');
$pending = null;
ff_update('kv', function ($kv) use ($state, &$pending) {
    $pending = $kv['oauth'][$state] ?? null;
    unset($kv['oauth'][$state]);
    return $kv;
});
if (!$pending || time() - $pending['created'] > 900) ff_back('error', 'This sign-in link expired. Please click Connect again.');
$p = $pending['provider'];
$creds = ff_provider_creds($p);
if (!$creds) ff_back('error', 'Add the ' . $p . ' app ID and secret in Setup first.');
try {
    [$label, $secret, $meta, $exp] = ff_oauth_finish($p, $creds, (string) ($_GET['code'] ?? ''), $pending['verifier']);
    $app = $pending['app'];
    if (!ff_app($app) || (ff_app($app)['oauth'] ?? '') !== $p) {
        foreach (ff_catalog()['apps'] as $a) if (($a['oauth'] ?? '') === $p) { $app = $a['key']; break; }
    }
    ff_save_connection($app, $label, $secret, $meta, $exp);
    ff_back('connected', $label);
} catch (Throwable $e) {
    ff_back('error', $e->getMessage());
}
