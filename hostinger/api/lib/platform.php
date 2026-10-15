<?php
declare(strict_types=1);

/* Platform settings: the site owner connects Meta, Claude and email from the dashboard. */

function platform_mask(string $v): string
{
    return $v === '' ? '' : '••••' . substr($v, -4);
}

function platform_settings(): array
{
    require_admin();
    $cfg = config();
    $values = [];
    foreach (PLATFORM_KEYS as $k) {
        $v = (string) ($cfg[$k] ?? '');
        $values[$k] = in_array($k, PLATFORM_SECRETS, true) ? platform_mask($v) : $v;
    }
    return [
        'values' => $values,
        'secrets' => PLATFORM_SECRETS,
        'redirectUri' => meta_redirect_uri(),
        'siteUrl' => base_url(),
        'privacyUrl' => base_url() . '/connector/privacy/',
        'termsUrl' => base_url() . '/connector/terms/',
    ];
}

/** Saves the posted keys. Empty secret fields keep the current value. */
function platform_settings_save(array $in): array
{
    require_admin();
    $cfg = config();
    $next = [];
    foreach (PLATFORM_KEYS as $k) {
        if (!array_key_exists($k, $in)) {
            continue;
        }
        $v = trim((string) $in[$k]);
        if (in_array($k, PLATFORM_SECRETS, true) && ($v === '' || str_starts_with($v, '••••'))) {
            continue; // unchanged
        }
        $next[$k] = $v;
    }
    if (isset($next['meta_app_id']) && $next['meta_app_id'] !== '' && !ctype_digit($next['meta_app_id'])) {
        fail('Meta App ID is a number, e.g. 1234567890123456');
    }
    if (isset($next['smtp_port']) && $next['smtp_port'] !== '' && !ctype_digit($next['smtp_port'])) {
        fail('SMTP port must be a number (465 or 587)');
    }

    // Check the Meta app before saving so a typo shows up right away.
    $warning = '';
    $appId = $next['meta_app_id'] ?? (string) ($cfg['meta_app_id'] ?? '');
    $secret = $next['meta_app_secret'] ?? (string) ($cfg['meta_app_secret'] ?? '');
    if ((isset($next['meta_app_id']) || isset($next['meta_app_secret'])) && $appId !== '' && $secret !== '') {
        try {
            graph('GET', 'oauth/access_token', ['client_id' => $appId, 'client_secret' => $secret, 'grant_type' => 'client_credentials']);
        } catch (Throwable $e) {
            if (!str_starts_with($e->getMessage(), 'Could not reach Meta')) {
                fail('Meta did not accept this App ID / App Secret. ' . $e->getMessage());
            }
            $warning = 'Saved, but Meta could not be reached to double-check the keys. Try "Connect Page" to test.';
        }
    }

    foreach ($next as $k => $v) {
        set_setting('platform.' . $k, $v);
    }
    return ['ok' => true, 'saved' => array_keys($next), 'warning' => $warning];
}

/** Sends a test email to the owner with the current SMTP settings. */
function platform_test_email(): array
{
    require_admin();
    $u = current_user();
    send_mail(
        (string) $u['email'],
        'Test email from Social Media Connector',
        email_layout('Email is working', 'Your SMTP settings are correct. Sign-up verification and password reset emails will be sent from this address.', null, null),
        'Your SMTP settings are correct.',
    );
    return ['ok' => true, 'to' => $u['email']];
}
