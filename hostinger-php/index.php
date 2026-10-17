<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
$mode = !ff_installed() ? 'install' : (ff_authed() ? 'app' : 'login');
$v = (string) filemtime(__DIR__ . '/assets/app.js');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>FlowForge — Workflow Automation</title>
<link rel="stylesheet" href="assets/app.css?v=<?= $v ?>">
</head>
<body class="ff">
<div id="root"></div>
<script>window.FF_MODE = <?= json_encode($mode) ?>;</script>
<script src="assets/app.js?v=<?= $v ?>"></script>
</body>
</html>
