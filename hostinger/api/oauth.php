<?php
// Single OAuth callback for every network: https://yourdomain.com/api/oauth.php
$_GET['action'] = 'oauth_callback';
require __DIR__ . '/index.php';
