<?php
declare(strict_types=1);

/* Sign up, email verification, login and password reset. */

function app_url(string $query = ''): string
{
    return base_url() . '/connector/app/' . ($query !== '' ? '?' . $query : '');
}

function valid_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function send_verification(array $user): void
{
    $token = bin2hex(random_bytes(24));
    db()->prepare('UPDATE users SET verify_token = ? WHERE id = ?')->execute([hash('sha256', $token), $user['id']]);
    $url = base_url() . '/api/index.php?action=verify&token=' . $token;
    send_mail(
        $user['email'],
        'Almost there: Verify your email to get started',
        email_layout('Verify your email to get started', 'Hi ' . htmlspecialchars($user['name']) . ', you’re almost there. Click below to verify your email address.', 'Verify Email', $url, 'If you didn’t create an account, you can ignore this email.'),
        "Verify your email: $url",
    );
}

function auth_signup(array $b): array
{
    if (empty(config()['signup_open'])) {
        fail('Sign-ups are closed right now.', 403);
    }
    rate_limit('signup', 5, 3600);
    $name = trim((string) ($b['name'] ?? ''));
    $email = strtolower(trim((string) ($b['email'] ?? '')));
    $password = (string) ($b['password'] ?? '');
    if ($name === '' || !valid_email($email)) {
        fail('Enter your name and a valid email.');
    }
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters.');
    }
    $pdo = db();
    $s = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $s->execute([$email]);
    $existing = $s->fetch();
    if ($existing && $existing['verified_at']) {
        json_out(['error' => 'You already have an account with this email. Log in, or reset your password if you forgot it.', 'exists' => true], 409);
    }
    if ($existing) {
        $pdo->prepare('UPDATE users SET name = ?, password_hash = ? WHERE id = ?')->execute([$name, password_hash($password, PASSWORD_DEFAULT), $existing['id']]);
        $id = (int) $existing['id'];
    } else {
        $pdo->prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
            ->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), now_iso()]);
        $id = (int) $pdo->lastInsertId();
    }
    $s = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $s->execute([$id]);
    send_verification($s->fetch());
    return ['ok' => true, 'email' => $email];
}

function auth_resend(array $b): array
{
    rate_limit('resend', 5, 3600);
    $s = db()->prepare('SELECT * FROM users WHERE email = ? AND verified_at IS NULL');
    $s->execute([strtolower(trim((string) ($b['email'] ?? '')))]);
    if ($u = $s->fetch()) {
        send_verification($u);
    }
    return ['ok' => true];
}

function auth_verify(string $token): never
{
    $s = db()->prepare('SELECT * FROM users WHERE verify_token = ?');
    $s->execute([hash('sha256', $token)]);
    $u = $s->fetch();
    if (!$u) {
        header('Location: ' . app_url('auth=invalid'));
        exit;
    }
    db()->prepare('UPDATE users SET verified_at = ?, verify_token = NULL WHERE id = ?')->execute([now_iso(), $u['id']]);
    login_user($u);
    header('Location: ' . app_url('welcome=1'));
    exit;
}

function auth_login(array $b): array
{
    rate_limit('login', 10, 900);
    $email = strtolower(trim((string) ($b['email'] ?? '')));
    $password = (string) ($b['password'] ?? '');
    $pdo = db();
    $s = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $s->execute([$email]);
    $u = $s->fetch();

    // First run after upgrading: the owner from smc-config.php becomes user #1.
    $cfg = config();
    if (!$u && !empty($cfg['admin_email']) && strcasecmp($email, (string) $cfg['admin_email']) === 0
        && (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0) {
        $pw = (string) ($cfg['admin_password'] ?? '');
        $ok = str_starts_with($pw, '$2y$') ? password_verify($password, $pw) : ($pw !== '' && hash_equals($pw, $password));
        if ($ok) {
            $pdo->prepare('INSERT INTO users (id, name, email, password_hash, verified_at, created_at) VALUES (1, ?, ?, ?, ?, ?)')
                ->execute([explode('@', $email)[0], $email, password_hash($password, PASSWORD_DEFAULT), now_iso(), now_iso()]);
            $s->execute([$email]);
            $u = $s->fetch();
        }
    }

    if (!$u || !password_verify($password, $u['password_hash'])) {
        fail('Wrong email or password.', 401);
    }
    if (!$u['verified_at']) {
        json_out(['error' => 'Please verify your email first. Check your inbox (and spam folder).', 'needsVerification' => true], 403);
    }
    login_user($u);
    return ['ok' => true, 'user' => user_public($u)];
}

function auth_forgot(array $b): array
{
    rate_limit('forgot', 5, 3600);
    $s = db()->prepare('SELECT * FROM users WHERE email = ?');
    $s->execute([strtolower(trim((string) ($b['email'] ?? '')))]);
    if ($u = $s->fetch()) {
        $token = bin2hex(random_bytes(24));
        db()->prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?')->execute([hash('sha256', $token), time() + 3600, $u['id']]);
        $url = app_url('reset=' . $token);
        send_mail(
            $u['email'],
            'Reset your Social Media Connector password',
            email_layout('Reset your password', 'We received a request to reset your password. This link is valid for 1 hour.', 'Reset Password', $url, 'If you didn’t ask for this, you can ignore this email — your password won’t change.'),
            "Reset your password: $url",
        );
    }
    // Same answer either way, so emails can't be probed.
    return ['ok' => true];
}

function auth_reset(array $b): array
{
    rate_limit('reset', 10, 3600);
    $password = (string) ($b['password'] ?? '');
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters.');
    }
    $s = db()->prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?');
    $s->execute([hash('sha256', (string) ($b['token'] ?? '')), time()]);
    $u = $s->fetch() ?: fail('This reset link has expired. Request a new one.');
    // Resetting via email also proves the address.
    db()->prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, verified_at = COALESCE(verified_at, ?) WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), now_iso(), $u['id']]);
    // New password: sign out every other device, then log in here.
    db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$u['id']]);
    login_user($u);
    return ['ok' => true, 'user' => user_public($u)];
}
