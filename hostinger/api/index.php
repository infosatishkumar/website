<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/meta.php';
require __DIR__ . '/lib/agent.php';

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    config();
} catch (Throwable $e) {
    fail($e->getMessage(), 500);
}

// State-changing requests must come from our own page (custom header → no cross-site forms).
if ($method === 'POST' && ($_SERVER['HTTP_X_SMC'] ?? '') !== '1') {
    fail('Bad request', 403);
}

$public = ['status', 'login', 'meta_callback'];
if (!in_array($action, $public, true) && !is_logged_in()) {
    fail('Please log in', 401);
}

$pdo = db();

try {
    switch ($action) {
        case 'status':
            $cfg = config();
            json_out([
                'backend' => true,
                'loggedIn' => is_logged_in(),
                'configured' => [
                    'anthropic' => !empty($cfg['anthropic_api_key']),
                    'meta' => !empty($cfg['meta_app_id']) && !empty($cfg['meta_app_secret']),
                ],
                'autopublish' => setting('autopublish', '0') === '1',
            ]);

        case 'login':
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
            $pdo->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 900]);
            $n = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ?');
            $n->execute([$ip]);
            if ((int) $n->fetchColumn() >= 10) {
                fail('Too many attempts. Try again in 15 minutes.', 429);
            }
            $b = body();
            $cfg = config();
            $pw = (string) $cfg['admin_password'];
            $okPass = str_starts_with($pw, '$2y$') ? password_verify((string) ($b['password'] ?? ''), $pw) : hash_equals($pw, (string) ($b['password'] ?? ''));
            if (!$okPass || strcasecmp((string) ($b['email'] ?? ''), (string) $cfg['admin_email']) !== 0) {
                $pdo->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([$ip, time()]);
                fail('Wrong email or password', 401);
            }
            start_session();
            session_regenerate_id(true);
            $_SESSION['smc_admin'] = true;
            json_out(['ok' => true]);

        case 'logout':
            start_session();
            $_SESSION = [];
            session_destroy();
            json_out(['ok' => true]);

        case 'accounts':
            json_out(array_map('account_public', $pdo->query('SELECT * FROM accounts ORDER BY id')->fetchAll()));

        case 'account_delete':
            $pdo->prepare('DELETE FROM accounts WHERE id = ?')->execute([(int) (body()['id'] ?? 0)]);
            json_out(['ok' => true]);

        case 'meta_connect':
            $cfg = config();
            if (empty($cfg['meta_app_id']) || empty($cfg['meta_app_secret'])) {
                fail('Add meta_app_id and meta_app_secret to smc-config.php first.', 400);
            }
            $_SESSION['meta_state'] = bin2hex(random_bytes(16));
            header('Location: ' . meta_login_url($_SESSION['meta_state']));
            exit;

        case 'meta_callback':
            start_session();
            $back = rtrim(config()['base_url'], '/') . '/connector/app/accounts/';
            if (!is_logged_in() || empty($_GET['state']) || !hash_equals((string) ($_SESSION['meta_state'] ?? ''), (string) $_GET['state'])) {
                header('Location: ' . $back . '?error=' . rawurlencode('Login expired, please try again.'));
                exit;
            }
            unset($_SESSION['meta_state']);
            if (!empty($_GET['error'])) {
                header('Location: ' . $back . '?error=' . rawurlencode((string) ($_GET['error_description'] ?? 'Connection cancelled')));
                exit;
            }
            try {
                $count = meta_handle_callback((string) ($_GET['code'] ?? ''));
                header('Location: ' . $back . '?connected=' . $count);
            } catch (Throwable $e) {
                header('Location: ' . $back . '?error=' . rawurlencode($e->getMessage()));
            }
            exit;

        case 'posts':
            json_out(array_map('post_public', $pdo->query('SELECT * FROM posts ORDER BY scheduled_at')->fetchAll()));

        case 'post_create':
            $b = body();
            $ids = array_values(array_map('strval', (array) ($b['accountIds'] ?? [])));
            $text = trim((string) ($b['text'] ?? ''));
            $status = in_array($b['status'] ?? '', ['draft', 'pending', 'scheduled', 'published'], true) ? $b['status'] : 'draft';
            $ts = strtotime((string) ($b['scheduledAt'] ?? '')) ?: time();
            $media = array_values(array_filter((array) ($b['media'] ?? []), 'is_own_upload'));
            if (!$ids || $text === '') {
                fail('Choose accounts and write a caption.');
            }
            // "published" from the composer means "publish now".
            $store = $status === 'published' ? 'scheduled' : $status;
            $pdo->prepare('INSERT INTO posts (text, account_ids, media, scheduled_at, status, tag_ids, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$text, json_encode($ids), json_encode($media), gmdate('Y-m-d\TH:i:s\Z', $ts), $store, json_encode((array) ($b['tagIds'] ?? [])), 'You', now_iso()]);
            $id = (int) $pdo->lastInsertId();
            $post = $status === 'published' ? publish_post($id) : $pdo->query("SELECT * FROM posts WHERE id = $id")->fetch();
            json_out(post_public($post));

        case 'post_update':
            $b = body();
            $id = (int) ($b['id'] ?? 0);
            $cur = $pdo->prepare('SELECT * FROM posts WHERE id = ?');
            $cur->execute([$id]);
            $post = $cur->fetch() ?: fail('Post not found', 404);
            if (in_array($post['status'], ['published', 'publishing'], true)) {
                fail('Published posts cannot be edited.');
            }
            $text = isset($b['text']) ? trim((string) $b['text']) : $post['text'];
            $at = isset($b['scheduledAt']) ? gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $b['scheduledAt']) ?: time()) : $post['scheduled_at'];
            $status = in_array($b['status'] ?? '', ['draft', 'pending', 'scheduled', 'rejected'], true) ? $b['status'] : $post['status'];
            $pdo->prepare('UPDATE posts SET text = ?, scheduled_at = ?, status = ? WHERE id = ?')->execute([$text, $at, $status, $id]);
            $cur->execute([$id]);
            json_out(post_public($cur->fetch()));

        case 'post_delete':
            $pdo->prepare('DELETE FROM posts WHERE id = ?')->execute([(int) (body()['id'] ?? 0)]);
            json_out(['ok' => true]);

        case 'post_publish':
            json_out(post_public(publish_post((int) (body()['id'] ?? 0))));

        case 'upload':
            $f = $_FILES['file'] ?? null;
            if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
                fail('Upload failed');
            }
            if ($f['size'] > 8 * 1024 * 1024) {
                fail('Image must be under 8 MB');
            }
            $info = @getimagesize($f['tmp_name']);
            $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'][$info[2] ?? 0] ?? null;
            if (!$ext) {
                fail('Only JPG, PNG, WEBP or GIF images');
            }
            $dir = dirname(__DIR__) . '/uploads';
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $name = gmdate('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
            if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) {
                fail('Could not save the image', 500);
            }
            json_out(['url' => rtrim(config()['base_url'], '/') . '/uploads/' . $name]);

        case 'agent_thread':
            json_out(['transcript' => agent_load_thread()['transcript'], 'autopublish' => setting('autopublish', '0') === '1']);

        case 'agent_message':
            $b = body();
            $text = trim((string) ($b['text'] ?? ''));
            if ($text === '') {
                fail('Write a message');
            }
            session_write_close(); // don't block other tabs while the agent works
            json_out(['transcript' => agent_message($text, (array) ($b['images'] ?? []))]);

        case 'agent_reset':
            $pdo->exec('DELETE FROM agent_threads');
            json_out(['ok' => true]);

        case 'agent_settings':
            set_setting('autopublish', !empty(body()['autopublish']) ? '1' : '0');
            json_out(['autopublish' => setting('autopublish') === '1']);

        default:
            fail('Unknown action', 404);
    }
} catch (Anthropic\Core\Exceptions\APIStatusException $e) {
    fail('Claude API error: ' . $e->getMessage(), 502);
} catch (Throwable $e) {
    fail($e->getMessage(), 500);
}
