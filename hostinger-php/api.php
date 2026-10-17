<?php
// FlowForge JSON API used by assets/app.js.
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_FLOWFORGE'] ?? '') !== '1') {
    ff_json(['error' => 'Bad request'], 400);
}
$in = ff_body();
$action = (string) ($in['action'] ?? '');

try {
    // ------------------------------------------------------ public actions --
    if ($action === 'install') {
        if (ff_installed()) ff_json(['error' => 'Already installed'], 400);
        $pw = (string) ($in['password'] ?? '');
        if (strlen($pw) < 8) ff_json(['error' => 'Use at least 8 characters.'], 400);
        ff_save_config([
            'passwordHash' => password_hash($pw, PASSWORD_DEFAULT),
            'secret' => bin2hex(random_bytes(32)),
            'cronKey' => ff_token(18),
            'createdAt' => gmdate('c'),
        ]);
        ff_session_start();
        session_regenerate_id(true);
        $_SESSION['ff_admin'] = true;
        ff_json(['ok' => true]);
    }
    if ($action === 'login') {
        ff_session_start();
        $tries = $_SESSION['ff_tries'] ?? [0, time()];
        if ($tries[0] >= 10 && time() - $tries[1] < 600) ff_json(['error' => 'Too many attempts. Try again in a few minutes.'], 429);
        if (!password_verify((string) ($in['password'] ?? ''), ff_config()['passwordHash'] ?? '')) {
            $_SESSION['ff_tries'] = [($tries[0] ?? 0) + 1, $tries[1] ?? time()];
            usleep(400000);
            ff_json(['error' => 'Wrong password.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['ff_admin'] = true;
        unset($_SESSION['ff_tries']);
        ff_json(['ok' => true]);
    }

    ff_require_auth();

    switch ($action) {
        case 'logout':
            $_SESSION = [];
            session_destroy();
            ff_json(['ok' => true]);

        case 'state': {
            $cfg = ff_config();
            $base = ff_app_url();
            $wfs = array_values(ff_read('workflows'));
            usort($wfs, fn($a, $b) => strcmp($b['updatedAt'], $a['updatedAt']));
            foreach ($wfs as &$w) $w['hookUrl'] = "$base/hook.php?id={$w['id']}&token={$w['hookToken']}";
            unset($w);
            $providers = [];
            foreach (array_keys(FF_SCOPES) as $p) {
                $providers[$p] = ['configured' => (bool) ff_provider_creds($p), 'redirectUri' => ff_redirect_uri($p), 'clientId' => $cfg['oauth'][$p]['id'] ?? ''];
            }
            ff_json([
                'catalog' => ff_catalog(),
                'workflows' => $wfs,
                'runs' => array_slice(ff_read('runs'), 0, 150),
                'connections' => array_values(array_map('ff_public_connection', ff_read('connections'))),
                'providers' => $providers,
                'system' => [
                    'appUrl' => $base,
                    'https' => str_starts_with($base, 'https://'),
                    'cronUrl' => "$base/cron.php?key=" . ($cfg['cronKey'] ?? ''),
                    'cronCommand' => 'php ' . FF_ROOT . '/cron.php',
                    'php' => PHP_VERSION,
                    'lastCron' => ff_read('kv')['lastCron'] ?? null,
                ],
            ]);
        }

        case 'save_workflow': {
            $w = $in['workflow'] ?? [];
            $steps = $w['steps'] ?? [];
            if (!is_array($steps) || !$steps) throw new RuntimeException('A workflow needs a trigger step.');
            $clean = [];
            foreach (array_slice($steps, 0, 30) as $i => $s) {
                if (!ff_app((string) ($s['app'] ?? ''))) throw new RuntimeException('Step ' . ($i + 1) . ': unknown app.');
                $config = [];
                foreach (($s['config'] ?? []) as $k => $v) $config[(string) $k] = mb_substr((string) $v, 0, 20000);
                $clean[] = [
                    'id' => preg_match('/^[\w-]{1,40}$/', (string) ($s['id'] ?? '')) ? $s['id'] : ff_id('step'),
                    'kind' => $i === 0 ? 'trigger' : ($s['app'] === 'filter' ? 'filter' : 'action'),
                    'app' => $s['app'],
                    'op' => (string) ($s['op'] ?? ''),
                    'label' => mb_substr((string) ($s['label'] ?? ''), 0, 120) ?: ff_app($s['app'])['name'],
                    'connectionId' => !empty($s['connectionId']) ? (string) $s['connectionId'] : null,
                    'config' => (object) $config,
                ];
            }
            $all = ff_read('workflows');
            $prev = isset($w['id']) ? ($all[$w['id']] ?? null) : null;
            $now = gmdate('c');
            $trigChanged = !$prev || $prev['steps'][0]['app'] !== $clean[0]['app'] || json_encode($prev['steps'][0]['config']) !== json_encode($clean[0]['config']);
            $wf = [
                'id' => $prev['id'] ?? ff_id('wf'),
                'name' => mb_substr(trim((string) ($w['name'] ?? '')), 0, 120) ?: 'Untitled workflow',
                'status' => ($w['status'] ?? '') === 'on' ? 'on' : 'off',
                'hookToken' => $prev['hookToken'] ?? ff_token(18),
                'steps' => $clean,
                'runs' => $prev['runs'] ?? 0,
                'createdAt' => $prev['createdAt'] ?? $now,
                'updatedAt' => $now,
                'state' => $trigChanged ? ['lastSample' => $prev['state']['lastSample'] ?? null] : ($prev['state'] ?? []),
            ];
            ff_sync_trigger($wf, $prev);
            ff_update('workflows', function ($a) use ($wf) { $a[$wf['id']] = $wf; return $a; });
            ff_json(['workflow' => $wf]);
        }

        case 'delete_workflow': {
            $id = (string) ($in['id'] ?? '');
            $wf = ff_read('workflows')[$id] ?? null;
            if ($wf) {
                try { ff_sync_trigger(array_merge($wf, ['status' => 'off']), $wf); } catch (Throwable $e) {}
                ff_update('workflows', function ($a) use ($id) { unset($a[$id]); return $a; });
            }
            ff_json(['ok' => true]);
        }

        case 'run_workflow': {
            $wf = ff_read('workflows')[(string) ($in['id'] ?? '')] ?? null;
            if (!$wf) ff_json(['error' => 'Save the workflow first.'], 404);
            $sample = $in['sample'] ?? ($wf['state']['lastSample'] ?? []);
            ff_json(['run' => ff_run_workflow($wf, $sample, 'test')]);
        }

        case 'clear_runs':
            ff_write('runs', []);
            ff_json(['ok' => true]);

        case 'connect': {
            $def = ff_app((string) ($in['app'] ?? ''));
            if (!$def || $def['auth'] !== 'token') ff_json(['error' => 'Unknown app.'], 400);
            $clean = [];
            foreach ($def['authFields'] ?? [] as $f) {
                $v = trim((string) ($in['fields'][$f['key']] ?? ''));
                if (!empty($f['required']) && $v === '') ff_json(['error' => $f['label'] . ' is required.'], 400);
                if ($v !== '') $clean[$f['key']] = $v;
            }
            [$label, $meta] = ff_verify_token($def['key'], $clean);
            ff_json(['connection' => ff_public_connection(ff_save_connection($def['key'], $label, $clean, $meta))]);
        }

        case 'disconnect': {
            $id = (string) ($in['id'] ?? '');
            ff_update('connections', function ($a) use ($id) { unset($a[$id]); return $a; });
            ff_json(['ok' => true]);
        }

        case 'save_oauth': {
            $p = (string) ($in['provider'] ?? '');
            if (!ff_is_provider($p)) ff_json(['error' => 'Unknown provider'], 400);
            $id = trim((string) ($in['clientId'] ?? ''));
            $secret = trim((string) ($in['clientSecret'] ?? ''));
            $cur = ff_config()['oauth'][$p] ?? [];
            ff_save_config(['oauth' => [$p => ['id' => $id, 'secret' => $secret !== '' ? $secret : ($cur['secret'] ?? '')]]]);
            ff_json(['ok' => true]);
        }

        case 'save_settings': {
            $url = trim((string) ($in['appUrl'] ?? ''));
            if ($url !== '' && !preg_match('#^https?://[^\s]+$#', $url)) ff_json(['error' => 'Site URL must start with http:// or https://'], 400);
            ff_save_config(['appUrl' => rtrim($url, '/')]);
            ff_json(['ok' => true]);
        }

        case 'change_password': {
            if (!password_verify((string) ($in['current'] ?? ''), ff_config()['passwordHash'])) ff_json(['error' => 'Current password is wrong.'], 400);
            if (strlen((string) ($in['next'] ?? '')) < 8) ff_json(['error' => 'Use at least 8 characters.'], 400);
            ff_save_config(['passwordHash' => password_hash((string) $in['next'], PASSWORD_DEFAULT)]);
            ff_json(['ok' => true]);
        }

        case 'cron_now':
            ff_json(ff_tick());
    }
    ff_json(['error' => 'Unknown action'], 400);
} catch (Throwable $e) {
    ff_json(['error' => $e->getMessage()], 400);
}
