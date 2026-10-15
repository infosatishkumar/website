<?php
/*
 * Social Media Connector — server settings.
 * Upload this file as smc-config.php ONE FOLDER ABOVE public_html:
 *   domains/yourdomain.com/smc-config.php
 */
return [
    // Website address, no trailing slash.
    'base_url' => 'https://yourdomain.com',

    // Owner login from the first version. After you log in once it becomes user #1
    // (existing accounts and posts move to that user). New users sign up on the site.
    'admin_email' => '',
    'admin_password' => '',

    // Let anyone create an account (true) or only existing users (false).
    'signup_open' => true,

    // Claude API key (console.anthropic.com → API Keys).
    'anthropic_api_key' => '',
    'anthropic_model' => 'claude-opus-5-5',
    // AI credits per day on the Free plan (paid plans get more, see lib/billing.php).
    'free_daily_credits' => 5,

    // Email for verification, password reset and demo bookings (Hostinger mailbox).
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'contact@satishkumar.net',
    'smtp_pass' => '',
    'mail_from' => 'contact@satishkumar.net',
    'mail_from_name' => 'Social Media Connector',

    // Demo booking calendar.
    'demo_notify_email' => 'contact@satishkumar.net',
    'demo_timezone' => 'Asia/Kolkata',
    'demo_hours' => ['10:00', '18:00'],
    'demo_days' => [1, 2, 3, 4, 5, 6], // 1 = Monday … 7 = Sunday

    // Meta app (developers.facebook.com → App settings → Basic).
    'meta_app_id' => '',
    'meta_app_secret' => '',
    // Facebook Login for Business → Configurations → Configuration ID (leave empty for classic Facebook Login).
    'meta_config_id' => '',
    'graph_version' => 'v23.0',

    // Other networks — easier to add from the website: Settings → Platform settings.
    // Callback / redirect URL for every developer app: https://yourdomain.com/api/oauth.php
    'instagram_app_id' => '', 'instagram_app_secret' => '',   // Instagram direct login
    'threads_app_id' => '', 'threads_app_secret' => '',
    'linkedin_client_id' => '', 'linkedin_client_secret' => '',
    'x_client_id' => '', 'x_client_secret' => '',
    'google_client_id' => '', 'google_client_secret' => '',   // YouTube + Google Business Profile
    'pinterest_app_id' => '', 'pinterest_app_secret' => '',
    'tiktok_client_key' => '', 'tiktok_client_secret' => '',

    // Random text that protects the web cron URL.
    'cron_secret' => 'change-this-random-string',

    // Database file (keep as is).
    'db_path' => __DIR__ . '/smc-data.sqlite',
];
