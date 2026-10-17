<?php
// Public webhook endpoint: hook.php?id=WORKFLOW_ID&token=SECRET
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$id = (string) ($_GET['id'] ?? '');
$wf = ff_read('workflows')[$id] ?? null;
$token = (string) ($_GET['token'] ?? $_SERVER['HTTP_X_FLOWFORGE_TOKEN'] ?? $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
if (!$wf || $token === '' || !hash_equals($wf['hookToken'], $token)) ff_json(['error' => 'Unknown hook'], 404);

$trig = $wf['steps'][0]['app'] ?? '';
if (!in_array($trig, ['webhook', 'telegram'], true)) ff_json(['error' => 'This workflow is not started by a webhook.'], 400);

$type = $_SERVER['CONTENT_TYPE'] ?? '';
$raw = file_get_contents('php://input') ?: '';
if (str_contains($type, 'application/json')) $body = json_decode($raw, true) ?? [];
elseif ($_POST) $body = $_POST;
else $body = $raw === '' ? [] : (json_decode($raw, true) ?? ['body' => $raw]);

$query = $_GET;
unset($query['id'], $query['token']);
$payload = is_array($body) && array_keys($body) !== range(0, count($body) - 1) || $body === []
    ? array_merge($query, $body)
    : array_merge($query, ['body' => $body]);

ff_set_state($id, ['lastSample' => $payload]);
if (($wf['status'] ?? '') !== 'on') {
    ff_json(['ok' => true, 'captured' => true, 'note' => 'Workflow is off; payload saved as sample data.'], 202);
}
$run = ff_run_workflow($wf, $payload, $trig === 'telegram' ? 'telegram' : 'webhook');
ff_json(['ok' => $run['status'] !== 'error', 'run' => $run['id'], 'status' => $run['status']]);
