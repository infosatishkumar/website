<?php
/*
 * Setup check — tells the dashboard what is missing on the server.
 * Written in plain PHP so it still runs on old PHP versions.
 * Never prints secrets.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$problems = array();
$info = array('php' => PHP_VERSION);

if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    $problems[] = 'PHP ' . PHP_VERSION . ' is too old. In hPanel → Advanced → PHP Configuration choose PHP 8.3.';
}
foreach (array('pdo_sqlite', 'curl', 'json', 'mbstring', 'openssl') as $ext) {
    if (!extension_loaded($ext)) {
        $problems[] = "PHP extension \"$ext\" is not enabled. Turn it on in hPanel → PHP Configuration → PHP extensions.";
    }
}
if (!is_file(__DIR__ . '/vendor/autoload.php')) {
    $problems[] = 'The api/vendor folder is missing. Upload the full zip again and extract it inside public_html.';
}

$candidates = array(dirname(__DIR__, 2) . '/smc-config.php', dirname(__DIR__) . '/smc-config.php');
$configFile = null;
foreach ($candidates as $f) {
    if (is_file($f)) {
        $configFile = $f;
        break;
    }
}
$info['config_expected_at'] = $candidates[0];
if (!$configFile) {
    $problems[] = 'smc-config.php not found. Upload it to: ' . $candidates[0] . ' (one folder above public_html).';
} else {
    $cfg = @include $configFile;
    if (!is_array($cfg)) {
        $problems[] = 'smc-config.php has an error — make sure it starts with <?php and ends with ];';
    } else {
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
        $base = isset($cfg['base_url']) ? $cfg['base_url'] : '';
        if ($base === '' || strpos($base, 'yourdomain.com') !== false) {
            $problems[] = 'Set base_url in smc-config.php to https://' . $host;
        } elseif ($host !== '' && parse_url($base, PHP_URL_HOST) !== $host) {
            $problems[] = 'base_url is ' . $base . ' but this site is ' . $host . '. Make them the same.';
        }
        if (empty($cfg['admin_email']) || empty($cfg['admin_password']) || $cfg['admin_password'] === 'change-this-long-password') {
            $problems[] = 'Set admin_email and a new admin_password in smc-config.php.';
        }
        if (empty($cfg['anthropic_api_key'])) {
            $problems[] = 'anthropic_api_key is empty — the AI Agent needs it (console.anthropic.com → API Keys).';
        } elseif (strpos($cfg['anthropic_api_key'], 'sk-ant-api') !== 0) {
            $problems[] = 'anthropic_api_key does not look like an API key. It must start with sk-ant-api (create one at console.anthropic.com → API Keys).';
        }
        if (empty($cfg['meta_app_id']) || empty($cfg['meta_app_secret'])) {
            $problems[] = 'meta_app_id / meta_app_secret are empty — Facebook & Instagram cannot connect until you add them.';
        }
        $dbDir = dirname(isset($cfg['db_path']) ? $cfg['db_path'] : $configFile);
        if (!is_writable($dbDir)) {
            $problems[] = 'The folder for the database is not writable: ' . $dbDir;
        }
    }
}
$uploads = dirname(__DIR__) . '/uploads';
if (is_dir($uploads) && !is_writable($uploads)) {
    $problems[] = 'public_html/uploads is not writable (set permission 755).';
}
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
if (!$https) {
    $problems[] = 'Site is not on https. Turn on SSL in hPanel → Security → SSL (Facebook login needs it).';
}

echo json_encode(array('ok' => count($problems) === 0, 'problems' => $problems, 'info' => $info));
