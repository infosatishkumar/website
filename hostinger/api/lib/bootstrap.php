<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

/** Settings the site owner can change from the dashboard (stored in the database). */
const PLATFORM_KEYS = [
    'meta_app_id', 'meta_app_secret', 'meta_config_id',
    'instagram_app_id', 'instagram_app_secret', 'threads_app_id', 'threads_app_secret',
    'linkedin_client_id', 'linkedin_client_secret', 'linkedin_page_client_id', 'linkedin_page_client_secret', 'x_client_id', 'x_client_secret',
    'google_client_id', 'google_client_secret', 'pinterest_app_id', 'pinterest_app_secret',
    'tiktok_client_key', 'tiktok_client_secret',
    'anthropic_api_key',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'mail_from', 'mail_from_name', 'demo_notify_email',
];
const PLATFORM_SECRETS = [
    'meta_app_secret', 'anthropic_api_key', 'smtp_pass', 'instagram_app_secret', 'threads_app_secret',
    'linkedin_client_secret', 'linkedin_page_client_secret', 'x_client_secret', 'google_client_secret', 'pinterest_app_secret', 'tiktok_client_secret',
];

/** Loads smc-config.php (one level above public_html, or public_html as a fallback). */
function config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    foreach ([dirname(__DIR__, 3) . '/smc-config.php', dirname(__DIR__, 2) . '/smc-config.php'] as $file) {
        if (is_file($file)) {
            $cfg = (require $file) + [
                'anthropic_model' => 'claude-opus-5-5',
                'graph_version' => 'v23.0',
                'signup_open' => true,
                'agent_daily_limit' => 50,
                'smtp_host' => 'smtp.hostinger.com',
                'smtp_port' => 465,
                'smtp_user' => '',
                'smtp_pass' => '',
                'mail_from' => '',
                'mail_from_name' => 'Social Media Connector',
                'demo_notify_email' => '',
                'demo_timezone' => 'Asia/Kolkata',
                'demo_hours' => ['10:00', '18:00'],
                'demo_days' => [1, 2, 3, 4, 5, 6],
            ];
            // Keys the owner saved from Platform settings on the website win over the file.
            try {
                foreach (db()->query("SELECT k, v FROM settings WHERE k LIKE 'platform.%'") as $row) {
                    $name = substr((string) $row['k'], 9);
                    if (in_array($name, PLATFORM_KEYS, true) && $row['v'] !== '') {
                        $cfg[$name] = $name === 'smtp_port' ? (int) $row['v'] : (string) $row['v'];
                    }
                }
            } catch (Throwable) {
                // database not ready yet: file values only
            }
            return $cfg;
        }
    }
    throw new RuntimeException('smc-config.php not found. Upload it one level above public_html.');
}

function base_url(): string
{
    return rtrim((string) config()['base_url'], '/');
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
    migrate($pdo);
    return $pdo;
}

function has_column(PDO $pdo, string $table, string $column): bool
{
    foreach ($pdo->query("PRAGMA table_info($table)")->fetchAll() as $c) {
        if ($c['name'] === $column) {
            return true;
        }
    }
    return false;
}

function migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        verified_at TEXT,
        verify_token TEXT,
        reset_token TEXT,
        reset_expires INTEGER,
        created_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        network TEXT NOT NULL,
        external_id TEXT NOT NULL,
        name TEXT NOT NULL,
        handle TEXT NOT NULL DEFAULT "",
        access_token TEXT NOT NULL,
        connected_at TEXT NOT NULL,
        UNIQUE(network, external_id)
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        text TEXT NOT NULL,
        account_ids TEXT NOT NULL,
        media TEXT NOT NULL DEFAULT "[]",
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL,
        tag_ids TEXT NOT NULL DEFAULT "[]",
        author TEXT NOT NULL DEFAULT "You",
        result TEXT NOT NULL DEFAULT "",
        created_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS agent_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL DEFAULT "New chat",
        history TEXT NOT NULL,
        transcript TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS auth_tokens (selector TEXT PRIMARY KEY, hash TEXT NOT NULL, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT NOT NULL, action TEXT NOT NULL DEFAULT "", at INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS pending_accounts (
        user_id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))');
    $pdo->exec('CREATE TABLE IF NOT EXISTS demo_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_at TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT "",
        notes TEXT NOT NULL DEFAULT "",
        created_at TEXT NOT NULL
    )');
    // Upgrades from the single-owner version: existing rows belong to user 1.
    foreach (['accounts', 'posts', 'agent_threads'] as $t) {
        if (!has_column($pdo, $t, 'user_id')) {
            $pdo->exec("ALTER TABLE $t ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1");
        }
    }
    foreach (['refresh_token' => 'TEXT NOT NULL DEFAULT ""', 'expires_at' => 'INTEGER NOT NULL DEFAULT 0', 'meta' => "TEXT NOT NULL DEFAULT '{}'"] as $col => $def) {
        if (!has_column($pdo, 'accounts', $col)) {
            $pdo->exec("ALTER TABLE accounts ADD COLUMN $col $def");
        }
    }
    if (!has_column($pdo, 'agent_threads', 'title')) {
        $pdo->exec('ALTER TABLE agent_threads ADD COLUMN title TEXT NOT NULL DEFAULT "New chat"');
    }
}

/* ---------------- settings, time, helpers ---------------- */

function setting(string $key, ?string $default = null): ?string
{
    $s = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $s->execute([$key]);
    $v = $s->fetchColumn();
    return $v === false ? $default : (string) $v;
}

function set_setting(string $key, string $value): void
{
    db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$key, $value]);
}

function user_setting(string $key, ?string $default = null): ?string
{
    return setting($key . ':' . uid(), $default);
}

function set_user_setting(string $key, string $value): void
{
    set_setting($key . ':' . uid(), $value);
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
}

/** Allows $max hits per $window seconds per IP for an action; fails with 429 beyond that. */
function rate_limit(string $action, int $max, int $window): void
{
    $pdo = db();
    $pdo->prepare('DELETE FROM rate_limits WHERE at < ?')->execute([time() - 86400]);
    $n = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE ip = ? AND action = ? AND at > ?');
    $n->execute([client_ip(), $action, time() - $window]);
    if ((int) $n->fetchColumn() >= $max) {
        fail('Too many attempts. Please try again later.', 429);
    }
    $pdo->prepare('INSERT INTO rate_limits (ip, action, at) VALUES (?, ?, ?)')->execute([client_ip(), $action, time()]);
}

/* ---------------- sessions & users ---------------- */

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    // Hostinger's default PHP session files are cleaned after ~24 minutes, which logged people out.
    // Keep ours in a private folder next to the database for 30 days.
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    $dir = dirname((string) config()['db_path']) . '/smc-sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        session_save_path($dir);
    }
    session_name('smc_session');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    start_session();
    $id = (int) ($_SESSION['uid'] ?? 0);
    if (!$id) {
        $id = remember_login();
    }
    if (!$id) {
        return $user = null;
    }
    $s = db()->prepare('SELECT * FROM users WHERE id = ? AND verified_at IS NOT NULL');
    $s->execute([$id]);
    return $user = ($s->fetch() ?: null);
}

/* ---------------- "keep me logged in" ---------------- */

const REMEMBER_COOKIE = 'smc_remember';
const REMEMBER_DAYS = 90;

function remember_cookie(string $value, int $expires): void
{
    setcookie(REMEMBER_COOKIE, $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Starts a logged-in session and a long-lived device token (selector + hashed validator). */
function login_user(array $u): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $u['id'];
    $selector = bin2hex(random_bytes(9));
    $validator = bin2hex(random_bytes(32));
    $expires = time() + REMEMBER_DAYS * 86400;
    db()->prepare('INSERT INTO auth_tokens (selector, hash, user_id, expires) VALUES (?, ?, ?, ?)')
        ->execute([$selector, hash('sha256', $validator), (int) $u['id'], $expires]);
    db()->prepare('DELETE FROM auth_tokens WHERE expires < ?')->execute([time()]);
    remember_cookie("$selector:$validator", $expires);
}

/** Restores the session from the device token when the PHP session is gone. */
function remember_login(): int
{
    $raw = (string) ($_COOKIE[REMEMBER_COOKIE] ?? '');
    if (!preg_match('/^([a-f0-9]{18}):([a-f0-9]{64})$/', $raw, $m)) {
        return 0;
    }
    $s = db()->prepare('SELECT * FROM auth_tokens WHERE selector = ? AND expires > ?');
    $s->execute([$m[1], time()]);
    $t = $s->fetch();
    if (!$t || !hash_equals($t['hash'], hash('sha256', $m[2]))) {
        remember_cookie('', time() - 3600);
        return 0;
    }
    // Rotate the validator so a copied cookie stops working.
    $validator = bin2hex(random_bytes(32));
    $expires = time() + REMEMBER_DAYS * 86400;
    db()->prepare('UPDATE auth_tokens SET hash = ?, expires = ? WHERE selector = ?')->execute([hash('sha256', $validator), $expires, $m[1]]);
    remember_cookie($m[1] . ":$validator", $expires);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $t['user_id'];
    return (int) $t['user_id'];
}

function logout_user(): void
{
    start_session();
    $raw = (string) ($_COOKIE[REMEMBER_COOKIE] ?? '');
    if (str_contains($raw, ':')) {
        db()->prepare('DELETE FROM auth_tokens WHERE selector = ?')->execute([explode(':', $raw)[0]]);
    }
    remember_cookie('', time() - 3600);
    $_SESSION = [];
    session_destroy();
}

function uid(): int
{
    $u = current_user();
    if (!$u) {
        fail('Please log in', 401);
    }
    return (int) $u['id'];
}

function user_public(array $u): array
{
    return ['id' => (string) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'isAdmin' => is_admin($u)];
}

/** The site owner: admin_email in smc-config.php (comma-separated allowed), else the first user. */
function is_admin(?array $u): bool
{
    if (!$u) {
        return false;
    }
    $emails = array_filter(array_map(fn ($e) => strtolower(trim($e)), explode(',', (string) (config()['admin_email'] ?? ''))));
    return $emails ? in_array(strtolower((string) $u['email']), $emails, true) : (int) $u['id'] === 1;
}

function require_admin(): void
{
    if (!is_admin(current_user())) {
        fail('Only the site owner can change platform settings', 403);
    }
}

/** Messages the AI may still send today (agent + AI captions share it). */
function ai_credits_left(): int
{
    $s = db()->prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?');
    $s->execute([uid(), gmdate('Y-m-d')]);
    return max(0, (int) config()['agent_daily_limit'] - (int) $s->fetchColumn());
}

function use_ai_credit(): void
{
    if (ai_credits_left() <= 0) {
        fail('You have used today’s AI limit. It resets at midnight (UTC).', 429);
    }
    db()->prepare('INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1')
        ->execute([uid(), gmdate('Y-m-d')]);
}

/* ---------------- http ---------------- */

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
    $data = json_decode(file_get_contents('php://input') ?: '', true);
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

/** Loads a post owned by the current user or fails with 404. */
function own_post(int $id): array
{
    $s = db()->prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?');
    $s->execute([$id, uid()]);
    return $s->fetch() ?: fail('Post not found', 404);
}
