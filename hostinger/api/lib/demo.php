<?php
declare(strict_types=1);

/* Demo booking: 30-minute slots in the owner's timezone, stored and emailed. */

const DEMO_MINUTES = 30;

/** All bookable slots (UTC ISO) for the next $days days, minus taken ones. */
function demo_slots(int $days = 30): array
{
    $cfg = config();
    $tz = new DateTimeZone((string) $cfg['demo_timezone']);
    [$from, $to] = $cfg['demo_hours'];
    $taken = array_flip(db()->query('SELECT slot_at FROM demo_bookings')->fetchAll(PDO::FETCH_COLUMN));
    $now = new DateTimeImmutable('now', $tz);
    $earliest = $now->modify('+2 hours');
    $slots = [];
    for ($d = 0; $d < $days; $d++) {
        $day = $now->setTime(0, 0)->modify("+$d day");
        if (!in_array((int) $day->format('N'), array_map('intval', (array) $cfg['demo_days']), true)) {
            continue;
        }
        $cursor = new DateTimeImmutable($day->format('Y-m-d') . ' ' . $from, $tz);
        $end = new DateTimeImmutable($day->format('Y-m-d') . ' ' . $to, $tz);
        while ($cursor < $end) {
            $iso = $cursor->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
            if ($cursor > $earliest && !isset($taken[$iso])) {
                $slots[] = $iso;
            }
            $cursor = $cursor->modify('+' . DEMO_MINUTES . ' minutes');
        }
    }
    return $slots;
}

function demo_book(array $b): array
{
    rate_limit('demo', 5, 3600);
    $slot = (string) ($b['slot'] ?? '');
    $name = trim((string) ($b['name'] ?? ''));
    $email = strtolower(trim((string) ($b['email'] ?? '')));
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter your name and a valid email.');
    }
    if (!in_array($slot, demo_slots(), true)) {
        fail('That time was just taken. Please pick another slot.');
    }
    try {
        db()->prepare('INSERT INTO demo_bookings (slot_at, name, email, company, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$slot, $name, $email, mb_substr(trim((string) ($b['company'] ?? '')), 0, 120), mb_substr(trim((string) ($b['notes'] ?? '')), 0, 1000), now_iso()]);
    } catch (PDOException) {
        fail('That time was just taken. Please pick another slot.');
    }

    $tz = new DateTimeZone((string) config()['demo_timezone']);
    $when = (new DateTimeImmutable($slot))->setTimezone($tz)->format('l, j F Y \a\t g:i A') . ' (' . $tz->getName() . ')';
    $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES);
    $mailed = true;
    try {
        send_mail($email, 'Your Social Media Connector demo is booked',
            email_layout('Your demo is booked', 'Hi ' . $e($name) . ', thanks for booking a 30-minute demo.<br><br><b>' . $e($when) . '</b><br><br>We’ll email you the meeting link before the call.', null, null),
            "Your demo is booked for $when.");
        $owner = (string) (config()['demo_notify_email'] ?: config()['smtp_user']);
        if ($owner !== '') {
            send_mail($owner, "New demo booking: $name — $when",
                email_layout('New demo booking', '<b>' . $e($name) . '</b> (' . $e($email) . ')<br>' . $e((string) ($b['company'] ?? '')) . '<br><br><b>' . $e($when) . '</b><br><br>' . nl2br($e((string) ($b['notes'] ?? ''))), null, null),
                "$name ($email) booked $when");
        }
    } catch (Throwable) {
        $mailed = false; // the booking itself is saved
    }
    return ['ok' => true, 'when' => $when, 'emailed' => $mailed];
}
