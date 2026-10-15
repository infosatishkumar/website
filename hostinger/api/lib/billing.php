<?php
declare(strict_types=1);

/*
 * Plans and UPI payments. People pay by UPI (QR or app link with the amount filled in),
 * then submit the UTR / transaction ID. The owner checks it in their UPI app and approves,
 * which switches the plan on. (Automatic confirmation needs a payment gateway.)
 */

/** Prices in INR (per month) — same as the pricing page. */
const PLANS = [
    'Essentials' => ['monthly' => 1499, 'annual' => 1199, 'credits' => 150],
    'Standard' => ['monthly' => 2999, 'annual' => 2399, 'credits' => 400],
    'Premium' => ['monthly' => 4999, 'annual' => 3999, 'credits' => 1000],
    'Ultimate' => ['monthly' => 8999, 'annual' => 7199, 'credits' => 3000],
];

function plan_amount(string $plan, string $cycle): int
{
    $p = PLANS[$plan] ?? fail('Unknown plan');
    return $cycle === 'annual' ? $p['annual'] * 12 : $p['monthly'];
}

/** The user's active plan, or "Free". */
function user_plan(?array $u): array
{
    if ($u && !empty($u['plan']) && isset(PLANS[$u['plan']]) && strtotime((string) $u['plan_until']) > time()) {
        return ['name' => $u['plan'], 'until' => $u['plan_until'], 'credits' => PLANS[$u['plan']]['credits']];
    }
    return ['name' => 'Free', 'until' => null, 'credits' => (int) config()['agent_daily_limit']];
}

function upi_info(): array
{
    $cfg = config();
    return ['upiId' => (string) ($cfg['upi_id'] ?? ''), 'payee' => (string) ($cfg['upi_name'] ?? ''), 'plans' => PLANS];
}

function payment_public(array $p): array
{
    return [
        'id' => (string) $p['id'], 'plan' => $p['plan'], 'cycle' => $p['cycle'], 'amount' => (int) $p['amount'], 'utr' => $p['utr'],
        'status' => $p['status'], 'createdAt' => $p['created_at'], 'decidedAt' => $p['decided_at'],
        'user' => isset($p['email']) ? ['name' => $p['name'], 'email' => $p['email']] : null,
    ];
}

function payment_create(array $b): array
{
    rate_limit('payment', 10, 3600);
    $plan = (string) ($b['plan'] ?? '');
    $cycle = ($b['cycle'] ?? '') === 'annual' ? 'annual' : 'monthly';
    $utr = strtoupper(preg_replace('/\s+/', '', (string) ($b['utr'] ?? '')) ?? '');
    $amount = plan_amount($plan, $cycle);
    if (!preg_match('/^[A-Z0-9]{10,25}$/', $utr)) {
        fail('Enter the 12-digit UPI reference number (UTR) from your payment app.');
    }
    $dupe = db()->prepare("SELECT COUNT(*) FROM payments WHERE utr = ? AND status <> 'rejected'");
    $dupe->execute([$utr]);
    if ((int) $dupe->fetchColumn() > 0) {
        fail('This transaction ID was already submitted.');
    }
    db()->prepare('INSERT INTO payments (user_id, plan, cycle, amount, utr, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([uid(), $plan, $cycle, $amount, $utr, 'pending', now_iso()]);
    $u = current_user();
    $owner = (string) (config()['demo_notify_email'] ?: config()['smtp_user']);
    if ($owner !== '') {
        try {
            $url = base_url() . '/connector/app/settings/payments/';
            send_mail($owner, "New payment: ₹$amount for $plan ($cycle)",
                email_layout('New UPI payment to check', htmlspecialchars("{$u['name']} ({$u['email']}) says they paid ₹$amount for $plan ($cycle). UTR: $utr. Check your UPI app, then approve it."), 'Review payment', $url),
                "{$u['name']} ({$u['email']}) paid Rs $amount for $plan ($cycle). UTR $utr. Approve: $url");
        } catch (Throwable) {
            // The payment is saved either way; the owner also sees it in the dashboard.
        }
    }
    return ['ok' => true, 'payments' => my_payments()];
}

function my_payments(): array
{
    $s = db()->prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $s->execute([uid()]);
    return array_map('payment_public', $s->fetchAll());
}

function all_payments(): array
{
    require_admin();
    $rows = db()->query('SELECT p.*, u.name, u.email FROM payments p JOIN users u ON u.id = p.user_id ORDER BY (p.status = \'pending\') DESC, p.id DESC LIMIT 200')->fetchAll();
    return array_map('payment_public', $rows);
}

function payment_decide(int $id, bool $approve): array
{
    require_admin();
    $s = db()->prepare("SELECT * FROM payments WHERE id = ? AND status = 'pending'");
    $s->execute([$id]);
    $p = $s->fetch() ?: fail('Payment not found or already decided.');
    db()->prepare('UPDATE payments SET status = ?, decided_at = ? WHERE id = ?')->execute([$approve ? 'approved' : 'rejected', now_iso(), $id]);
    $u = db()->prepare('SELECT * FROM users WHERE id = ?');
    $u->execute([$p['user_id']]);
    $user = $u->fetch();
    if ($approve && $user) {
        // Extend from today, or from the end of a plan that is still running.
        $from = max(time(), (int) strtotime((string) ($user['plan_until'] ?? '')));
        $until = gmdate('Y-m-d\TH:i:s\Z', strtotime($p['cycle'] === 'annual' ? '+1 year' : '+1 month', $from));
        db()->prepare('UPDATE users SET plan = ?, plan_until = ? WHERE id = ?')->execute([$p['plan'], $until, $user['id']]);
    }
    if ($user) {
        try {
            send_mail($user['email'], $approve ? "Your {$p['plan']} plan is active" : 'About your payment',
                email_layout($approve ? "Welcome to {$p['plan']}!" : 'We could not confirm your payment',
                    $approve ? 'Thanks for your payment. Your plan is now active and your AI credits have been increased.'
                        : 'We could not find a payment with the reference number you sent (' . htmlspecialchars($p['utr']) . '). Please reply to this email with a screenshot of the payment.',
                    'Open dashboard', base_url() . '/connector/app/launchpad/'),
                $approve ? 'Your plan is active.' : 'We could not confirm your payment.');
        } catch (Throwable) {
        }
    }
    return ['ok' => true, 'payments' => all_payments()];
}
