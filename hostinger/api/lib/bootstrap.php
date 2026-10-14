<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

/** Loads smc-config.php from above public_html (two levels up from /api/lib). */
function config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $candidates = [
        dirname(__DIR__, 3) . '/smc-config.php', // one level above public_html
        dirname(__DIR__, 2) . '/smc-config.php', // fallback: inside public_html root (blocked by .htaccess)
    ];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $cfg = require $file;
            return $cfg;
        }
    }
    throw new RuntimeException('smc-config.php not found. Upload it one level above public_html.');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . config()['db_path']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL,          -- facebook | instagram
        external_id TEXT NOT NULL,      -- page id or instagram user id
        name TEXT NOT NULL,
        handle TEXT NOT NULL DEFAULT "",
        access_token TEXT NOT NULL,     -- page access token (instagram uses its page token)
        connected_at TEXT NOT NULL,
        UNIQUE(network, external_id)
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        account_ids TEXT NOT NULL,      -- JSON array of account ids
        media TEXT NOT NULL DEFAULT "[]", -- JSON array of public image URLs
        scheduled_at TEXT NOT NULL,     -- ISO-8601 UTC
        status TEXT NOT NULL,           -- draft | pending | scheduled | publishing | published | failed
        tag_ids TEXT NOT NULL DEFAULT "[]",
        author TEXT NOT NULL DEFAULT "You",
        result TEXT NOT NULL DEFAULT "",  -- JSON per-account publish result / error
        created_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS agent_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history TEXT NOT NULL,          -- JSON message history (API wire format)
        transcript TEXT NOT NULL,       -- JSON list shown in the UI
        updated_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL)');
    return $pdo;
}

function setting(string $key, ?string $default = null): ?string
{
    $s = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $s->execute([$key]);
    $v = $s->fetchColumn();
    return $v === false ? $default : (string) $v;
}

function set_setting(string $key, string $value): void
{
    db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
        ->execute([$key, $value]);
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('smc_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function is_logged_in(): bool
{
    start_session();
    return !empty($_SESSION['smc_admin']);
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): never
{
    json_out(['error' => $message], $status);
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function account_public(array $a): array
{
    return [
        'id' => (string) $a['id'],
        'network' => $a['network'],
        'name' => $a['name'],
        'handle' => $a['handle'],
        'connectedAt' => $a['connected_at'],
    ];
}

function post_public(array $p): array
{
    return [
        'id' => (string) $p['id'],
        'text' => $p['text'],
        'accountIds' => array_map('strval', json_decode($p['account_ids'], true) ?: []),
        'media' => json_decode($p['media'], true) ?: [],
        'scheduledAt' => $p['scheduled_at'],
        'status' => $p['status'],
        'tagIds' => json_decode($p['tag_ids'], true) ?: [],
        'author' => $p['author'],
        'result' => json_decode($p['result'] ?: '{}', true) ?: (object) [],
    ];
}
