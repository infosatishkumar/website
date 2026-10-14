<?php
declare(strict_types=1);

/*
 * Publishes scheduled posts that are due.
 * hPanel → Advanced → Cron Jobs, every 5 minutes:
 *   /usr/bin/php /home/uXXXX/domains/yourdomain.com/public_html/api/cron.php
 * (or call https://yourdomain.com/api/cron.php?key=CRON_SECRET from an external cron service)
 */

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/meta.php';

if (PHP_SAPI !== 'cli') {
    $secret = (string) (config()['cron_secret'] ?? '');
    if ($secret === '' || !hash_equals($secret, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit('Forbidden');
    }
}

@set_time_limit(280);
$due = db()->prepare("SELECT id FROM posts WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 20");
$due->execute([now_iso()]);
$done = 0;
foreach ($due->fetchAll(PDO::FETCH_COLUMN) as $id) {
    try {
        $post = publish_post((int) $id);
        echo "Post $id: {$post['status']}\n";
        $done++;
    } catch (Throwable $e) {
        echo "Post $id: {$e->getMessage()}\n";
    }
}
echo "Processed $done post(s)\n";
