<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/mail.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/meta.php';
require __DIR__ . '/lib/agent.php';
require __DIR__ . '/lib/demo.php';
require __DIR__ . '/lib/platform.php';

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    config();
} catch (Throwable $e) {
    fail($e->getMessage(), 500);
}

// State-changing requests must come from our own pages (custom header → no cross-site forms).
if ($method === 'POST' && ($_SERVER['HTTP_X_SMC'] ?? '') !== '1') {
    fail('Bad request', 403);
}

$public = ['status', 'signup', 'resend', 'verify', 'login', 'forgot', 'reset', 'demo_slots', 'demo_book'];
if (!in_array($action, $public, true) && !current_user()) {
    if ($action === 'meta_callback') {
        header('Location: ' . app_url('auth=expired'));
        exit;
    }
    fail('Please log in', 401);
}

$pdo = db();

try {
    switch ($action) {
        /* ---------- status & auth ---------- */
        case 'status':
            $cfg = config();
            $u = current_user();
            json_out([
                'backend' => true,
                'loggedIn' => (bool) $u,
                'user' => $u ? user_public($u) : null,
                'signupOpen' => !empty($cfg['signup_open']),
                'configured' => [
                    'anthropic' => !empty($cfg['anthropic_api_key']),
                    'meta' => !empty($cfg['meta_app_id']) && !empty($cfg['meta_app_secret']),
                    'email' => !empty($cfg['smtp_user']) && !empty($cfg['smtp_pass']),
                ],
                'autopublish' => $u ? user_setting('autopublish', '0') === '1' : false,
                'credits' => $u ? ai_credits_left() : 0,
                'creditsPerDay' => (int) $cfg['agent_daily_limit'],
            ]);

        case 'signup':
            json_out(auth_signup(body()));
        case 'resend':
            json_out(auth_resend(body()));
        case 'verify':
            auth_verify((string) ($_GET['token'] ?? ''));
        case 'login':
            json_out(auth_login(body()));
        case 'forgot':
            json_out(auth_forgot(body()));
        case 'reset':
            json_out(auth_reset(body()));
        case 'logout':
            start_session();
            $_SESSION = [];
            session_destroy();
            json_out(['ok' => true]);

        /* ---------- accounts ---------- */
        case 'accounts':
            $s = $pdo->prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id');
            $s->execute([uid()]);
            json_out(array_map('account_public', $s->fetchAll()));

        case 'account_delete':
            $pdo->prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?')->execute([(int) (body()['id'] ?? 0), uid()]);
            json_out(['ok' => true]);

        case 'meta_connect':
            $cfg = config();
            if (empty($cfg['meta_app_id']) || empty($cfg['meta_app_secret'])) {
                fail('Facebook & Instagram connection is not set up yet. The site owner can add the Meta app in Settings → Platform settings.', 400);
            }
            $_SESSION['meta_state'] = bin2hex(random_bytes(16));
            $_SESSION['meta_kind'] = in_array($_GET['kind'] ?? '', ['facebook', 'instagram'], true) ? $_GET['kind'] : 'all';
            header('Location: ' . meta_login_url($_SESSION['meta_state']));
            exit;

        case 'meta_callback':
            $back = base_url() . '/connector/app/accounts/';
            if (empty($_GET['state']) || !hash_equals((string) ($_SESSION['meta_state'] ?? ''), (string) $_GET['state'])) {
                header('Location: ' . $back . '?error=' . rawurlencode('Login expired, please try again.'));
                exit;
            }
            unset($_SESSION['meta_state']);
            if (!empty($_GET['error'])) {
                header('Location: ' . $back . '?error=' . rawurlencode((string) ($_GET['error_description'] ?? 'Connection cancelled')));
                exit;
            }
            try {
                meta_handle_callback((string) ($_GET['code'] ?? ''), (string) ($_SESSION['meta_kind'] ?? 'all'));
                header('Location: ' . base_url() . '/connector/app/accounts/select/');
            } catch (Throwable $e) {
                header('Location: ' . $back . '?error=' . rawurlencode($e->getMessage()));
            }
            exit;

        case 'meta_pending':
            json_out(meta_pending());

        case 'meta_pending_connect':
            $n = meta_connect_selected((array) (body()['keys'] ?? []));
            json_out(['connected' => $n]);

        /* ---------- posts ---------- */
        case 'posts':
            $s = $pdo->prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY scheduled_at');
            $s->execute([uid()]);
            json_out(array_map('post_public', $s->fetchAll()));

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
            $own = $pdo->prepare('SELECT COUNT(*) FROM accounts WHERE user_id = ? AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
            $own->execute([uid(), ...$ids]);
            if ((int) $own->fetchColumn() !== count($ids)) {
                fail('One of the selected accounts is not connected.');
            }
            // "published" from the composer means "publish now".
            $store = $status === 'published' ? 'scheduled' : $status;
            $pdo->prepare('INSERT INTO posts (user_id, text, account_ids, media, scheduled_at, status, tag_ids, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([uid(), $text, json_encode($ids), json_encode($media), gmdate('Y-m-d\TH:i:s\Z', $ts), $store, json_encode((array) ($b['tagIds'] ?? [])), 'You', now_iso()]);
            $id = (int) $pdo->lastInsertId();
            json_out(post_public($status === 'published' ? publish_post($id) : own_post($id)));

        case 'post_update':
            $b = body();
            $post = own_post((int) ($b['id'] ?? 0));
            if (in_array($post['status'], ['published', 'publishing'], true)) {
                fail('Published posts cannot be edited.');
            }
            $text = isset($b['text']) ? trim((string) $b['text']) : $post['text'];
            $at = isset($b['scheduledAt']) ? gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $b['scheduledAt']) ?: time()) : $post['scheduled_at'];
            $status = in_array($b['status'] ?? '', ['draft', 'pending', 'scheduled', 'rejected'], true) ? $b['status'] : $post['status'];
            $pdo->prepare('UPDATE posts SET text = ?, scheduled_at = ?, status = ? WHERE id = ?')->execute([$text, $at, $status, $post['id']]);
            json_out(post_public(own_post((int) $post['id'])));

        case 'post_delete':
            $pdo->prepare('DELETE FROM posts WHERE id = ? AND user_id = ?')->execute([(int) (body()['id'] ?? 0), uid()]);
            json_out(['ok' => true]);

        case 'post_publish':
            $post = own_post((int) (body()['id'] ?? 0));
            json_out(post_public(publish_post((int) $post['id'])));

        case 'upload':
            uid();
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
            json_out(['url' => base_url() . '/uploads/' . $name]);

        /* ---------- AI ---------- */
        case 'agent_threads':
            json_out(['threads' => agent_threads(), 'credits' => ai_credits_left()]);

        case 'agent_thread':
            $t = agent_load_thread((int) ($_GET['id'] ?? 0));
            json_out(['threadId' => $t['id'] ? (string) $t['id'] : null, 'title' => $t['title'], 'transcript' => $t['transcript']]);

        case 'agent_thread_delete':
            $pdo->prepare('DELETE FROM agent_threads WHERE id = ? AND user_id = ?')->execute([(int) (body()['id'] ?? 0), uid()]);
            json_out(['ok' => true]);

        case 'agent_message':
            $b = body();
            $text = trim((string) ($b['text'] ?? ''));
            if ($text === '') {
                fail('Write a message');
            }
            uid();
            session_write_close(); // don't block other tabs while the agent works
            json_out(agent_message(!empty($b['threadId']) ? (int) $b['threadId'] : null, $text, (array) ($b['images'] ?? [])));

        /* ---------- platform settings (site owner) ---------- */
        case 'platform_settings':
            json_out(platform_settings());
        case 'platform_settings_save':
            if ($method !== 'POST') {
                fail('POST required', 405);
            }
            json_out(platform_settings_save(body()));
        case 'platform_test_email':
            if ($method !== 'POST') {
                fail('POST required', 405);
            }
            json_out(platform_test_email());

        case 'agent_settings':
            set_user_setting('autopublish', !empty(body()['autopublish']) ? '1' : '0');
            json_out(['autopublish' => user_setting('autopublish') === '1']);

        case 'ai_captions':
            $b = body();
            $idea = trim((string) ($b['idea'] ?? ''));
            if ($idea === '') {
                fail('Describe your idea first.');
            }
            session_write_close();
            json_out(ai_captions(mb_substr($idea, 0, 1000), (string) ($b['tone'] ?? 'Friendly'), (array) ($b['networks'] ?? [])));

        /* ---------- demo booking (public) ---------- */
        case 'demo_slots':
            json_out(['slots' => demo_slots(), 'timezone' => config()['demo_timezone']]);

        case 'demo_book':
            json_out(demo_book(body()));

        default:
            fail('Unknown action', 404);
    }
} catch (Anthropic\Core\Exceptions\APIStatusException $e) {
    fail('Claude API error: ' . $e->getMessage(), 502);
} catch (PHPMailer\PHPMailer\Exception $e) {
    fail('Could not send email: ' . $e->getMessage() . ' — the site owner can check email settings in Settings → Platform settings.', 502);
} catch (Throwable $e) {
    fail($e->getMessage(), 500);
}
