<?php
/*
 * Social Media Connector — server config.
 *
 * 1. Copy this file to smc-config.php and fill in the values.
 * 2. Upload smc-config.php ONE LEVEL ABOVE public_html
 *    (e.g. /home/uXXXX/domains/yourdomain.com/smc-config.php),
 *    so it can never be downloaded from the web.
 */
return [
    // Public address of the site, no trailing slash.
    'base_url' => 'https://yourdomain.com',

    // Dashboard login (only you). Use a long password.
    'admin_email' => 'you@example.com',
    'admin_password' => 'change-this-long-password',

    // Claude API key from console.anthropic.com → API Keys (starts with sk-ant-api03-).
    'anthropic_api_key' => '',
    'anthropic_model' => 'claude-opus-5-5',

    // Meta app from developers.facebook.com (Facebook Login for Business).
    'meta_app_id' => '',
    'meta_app_secret' => '',
    // Facebook Login for Business → Configurations → Configuration ID (leave empty for classic Facebook Login).
    'meta_config_id' => '',
    'graph_version' => 'v23.0',

    // Random string; protects the web-triggered cron URL.
    'cron_secret' => 'change-this-random-string',

    // Database file — keep it outside public_html (default: next to this file).
    'db_path' => __DIR__ . '/smc-data.sqlite',
];
