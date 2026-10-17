<?php
// FlowForge (PHP edition) — shared helpers: config, storage, crypto, auth, HTTP.
declare(strict_types=1);

if (!defined('FF_ROOT')) define('FF_ROOT', dirname(__DIR__));
const FF_DATA = FF_ROOT . '/data';
const FF_GUARD = "<?php exit; ?>\n";

ini_set('display_errors', '0');
date_default_timezone_set('UTC');

// ---------------------------------------------------------------- storage --
// Each collection is a PHP file that exits immediately if requested over
// HTTP, followed by JSON. Writes take an exclusive lock.

function ff_path(string $name): string { return FF_DATA . '/' . $name . '.php'; }

function ff_read(string $name, $default = []) {
    $file = ff_path($name);
    if (!is_file($file)) return $default;
    $raw = file_get_contents($file);
    if ($raw === false) return $default;
    $json = substr($raw, strlen(FF_GUARD));
    $val = json_decode($json, true);
    return $val === null ? $default : $val;
}

/** Atomically read-modify-write a collection. */
function ff_update(string $name, callable $fn, $default = []) {
    if (!is_dir(FF_DATA)) mkdir(FF_DATA, 0755, true);
    $fh = fopen(ff_path($name), 'c+');
    if (!$fh) throw new RuntimeException('Cannot open data file; check folder permissions for /data.');
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $cur = $raw ? json_decode(substr($raw, strlen(FF_GUARD)), true) : null;
    if ($cur === null) $cur = $default;
    $next = $fn($cur);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, FF_GUARD . json_encode($next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $next;
}

function ff_write(string $name, $value): void { ff_update($name, fn() => $value); }

// ----------------------------------------------------------------- config --

function ff_config(): array { return ff_read('config', []); }
function ff_installed(): bool { return !empty(ff_config()['passwordHash']); }
function ff_save_config(array $patch): array {
    return ff_update('config', fn($c) => array_replace_recursive($c ?: [], $patch));
}

function ff_app_url(): string {
    $cfg = ff_config();
    if (!empty($cfg['appUrl'])) return rtrim($cfg['appUrl'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $dir;
}

// ----------------------------------------------------------------- crypto --

function ff_key(string $purpose): string {
    $secret = ff_config()['secret'] ?? '';
    if (strlen($secret) < 32) throw new RuntimeException('FlowForge is not installed.');
    return hash('sha256', $purpose . ':' . $secret, true);
}

function ff_encrypt($value): string {
    $iv = random_bytes(12);
    $tag = '';
    $data = openssl_encrypt(json_encode($value), 'aes-256-gcm', ff_key('enc'), OPENSSL_RAW_DATA, $iv, $tag);
    return implode('.', array_map('ff_b64', [$iv, $tag, $data]));
}

function ff_decrypt(string $payload) {
    [$iv, $tag, $data] = array_map('ff_unb64', explode('.', $payload));
    $out = openssl_decrypt($data, 'aes-256-gcm', ff_key('enc'), OPENSSL_RAW_DATA, $iv, $tag);
    if ($out === false) throw new RuntimeException('Could not decrypt stored credentials (secret changed?). Reconnect the account.');
    return json_decode($out, true);
}

function ff_b64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function ff_unb64(string $s): string { return base64_decode(strtr($s, '-_', '+/')); }
function ff_token(int $bytes = 24): string { return ff_b64(random_bytes($bytes)); }
function ff_id(string $prefix): string { return $prefix . '_' . bin2hex(random_bytes(6)); }

// ------------------------------------------------------------------- auth --

function ff_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('ff_session');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 14,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => str_starts_with(ff_app_url(), 'https://'),
    ]);
    session_start();
}

function ff_authed(): bool {
    ff_session_start();
    return !empty($_SESSION['ff_admin']);
}

function ff_require_auth(): void {
    if (!ff_authed()) ff_json(['error' => 'Not signed in'], 401);
}

// ------------------------------------------------------------------- http --

function ff_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ff_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function ff_is_private_ip(string $ip): bool {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
}

/**
 * Outbound HTTP via cURL. With $untrusted the host must resolve to a public
 * address (SSRF guard) and every redirect hop is re-checked.
 * Returns [status, headers(array), body(string)].
 */
function ff_http(string $method, string $url, array $headers = [], $body = null, bool $untrusted = false, int $hops = 5): array {
    $parts = parse_url($url);
    if (!$parts || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) throw new RuntimeException("Invalid URL: $url");
    if (!empty($parts['user']) || !empty($parts['pass'])) throw new RuntimeException('Credentials in URLs are not allowed.');
    $ch = curl_init();
    if ($untrusted) {
        $host = $parts['host'];
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if (!$ips) throw new RuntimeException("Could not resolve $host");
        foreach ($ips as $ip) if (ff_is_private_ip($ip)) throw new RuntimeException('Requests to private network addresses are blocked.');
        $port = $parts['port'] ?? (($parts['scheme'] === 'https') ? 443 : 80);
        curl_setopt($ch, CURLOPT_RESOLVE, ["$host:$port:{$ips[0]}"]);
    }
    $respHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERAGENT => 'FlowForge/1.0',
        CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$respHeaders) {
            $p = explode(':', $line, 2);
            if (count($p) === 2) $respHeaders[strtolower(trim($p[0]))] = trim($p[1]);
            return strlen($line);
        },
    ]);
    if ($body !== null && $method !== 'GET') curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $resp = curl_exec($ch);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("Network error: $err");
    }
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status >= 300 && $status < 400 && !empty($respHeaders['location'])) {
        if ($hops <= 0) throw new RuntimeException('Too many redirects.');
        $next = $respHeaders['location'];
        if (!preg_match('#^https?://#i', $next)) {
            $next = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') . '/' . ltrim($next, '/');
        }
        $m = $status === 303 ? 'GET' : $method;
        return ff_http($m, $next, $headers, $m === 'GET' ? null : $body, $untrusted, $hops - 1);
    }
    return [$status, $respHeaders, $resp];
}

/** Calls an API and returns decoded JSON, throwing a readable error on non-2xx. */
function ff_api(string $what, string $method, string $url, array $headers = [], $body = null, bool $untrusted = false): array {
    [$status, , $resp] = ff_http($method, $url, $headers, $body, $untrusted);
    $data = json_decode($resp, true);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException("$what failed (HTTP $status): " . mb_substr(is_array($data) ? json_encode($data) : (string) $resp, 0, 500));
    }
    return is_array($data) ? $data : ['response' => $resp];
}

function ff_json_post(string $what, string $url, $payload, array $headers = [], bool $untrusted = false): array {
    return ff_api($what, 'POST', $url, array_merge(['Content-Type: application/json'], $headers), json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $untrusted);
}

function ff_form_post(string $what, string $url, array $fields, array $headers = []): array {
    return ff_api($what, 'POST', $url, array_merge(['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], $headers), http_build_query($fields));
}

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/oauth.php';
require_once __DIR__ . '/apps.php';
require_once __DIR__ . '/engine.php';
