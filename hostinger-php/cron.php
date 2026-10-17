<?php
// Fires schedules and polls RSS feeds.
// Hostinger hPanel → Advanced → Cron Jobs → "PHP" type, every 5 minutes, command:
//   php /home/<user>/public_html/cron.php
// Or call https://yourdomain.com/cron.php?key=YOUR_CRON_KEY from any cron service.
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    $key = (string) ($_GET['key'] ?? '');
    if (!ff_installed() || $key === '' || !hash_equals((string) (ff_config()['cronKey'] ?? ''), $key)) ff_json(['error' => 'Unauthorized'], 401);
}
if (!ff_installed()) { echo "FlowForge is not installed yet.\n"; exit(1); }
$report = ff_tick();
ff_update('kv', function ($kv) { $kv['lastCron'] = gmdate('c'); return $kv; });
if (PHP_SAPI === 'cli') { echo json_encode($report) . "\n"; exit; }
ff_json($report);
