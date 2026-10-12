<?php
// DigitalNgage — lead form handler (used by contact.html via fetch)
header("Content-Type: application/json; charset=UTF-8");

function respond($status, $msg) {
    echo json_encode(['status' => $status, 'msg' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond('error', 'Invalid request');
}

// Honeypot: real visitors never fill this hidden field.
if (!empty($_POST['website'])) {
    respond('success', 'Message sent successfully');
}

// Strip line breaks from single-line fields so they cannot inject mail headers.
function clean_line($key, $max = 150) {
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = str_replace(["\r", "\n", "%0a", "%0d"], ' ', $v);
    return mb_substr($v, 0, $max);
}

$name    = clean_line('name', 100);
$phone   = clean_line('phone', 20);
$email   = clean_line('email', 150);
$company = clean_line('company', 150);
$service = clean_line('service', 100);
$message = isset($_POST['message']) ? mb_substr(trim((string) $_POST['message']), 0, 3000) : '';

if ($name === '' || $phone === '' || $service === '') {
    respond('error', 'Required fields missing');
}
if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
    respond('error', 'Invalid phone number');
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond('error', 'Invalid email address');
}

$to      = "contact@digitalngage.com";
$subject = "=?UTF-8?B?" . base64_encode("New Lead: $name — $service") . "?=";

$body  = "NEW LEAD — digitalngage.com\r\n";
$body .= "================================\r\n\r\n";
$body .= "Name    : $name\r\n";
$body .= "Phone   : $phone\r\n";
$body .= "Email   : " . ($email !== '' ? $email : 'Not provided') . "\r\n";
$body .= "Company : " . ($company !== '' ? $company : 'Not provided') . "\r\n";
$body .= "Service : $service\r\n\r\n";
$body .= "Message :\r\n" . ($message !== '' ? $message : 'No message') . "\r\n\r\n";
$body .= "================================\r\n";
$body .= "Sent from: digitalngage.com\r\n";

$from     = "no-reply@digitalngage.com";
$fromName = "DigitalNgage Website";

/*
 * 1) Preferred: send through Hostinger SMTP, logged in as the no-reply mailbox.
 *    Mail sent this way is signed for digitalngage.com (SPF/DKIM) and lands in
 *    the inbox instead of spam. Needs smtp-config.php (see smtp-config.sample.php),
 *    kept one folder ABOVE public_html so it can never be downloaded.
 * 2) Fallback: PHP mail(), so a lead is never lost if SMTP is not set up or fails.
 */
$config = null;
foreach ([__DIR__ . '/../smtp-config.php', __DIR__ . '/smtp-config.php'] as $file) {
    if (is_readable($file)) {
        $config = include $file;
        break;
    }
}

if (is_array($config) && !empty($config['password'])) {
    $err = smtp_send($config, $to, $from, $fromName, $email, "New Lead: $name — $service", $body);
    if ($err === null) {
        respond('success', 'Message sent successfully');
    }
    error_log("DigitalNgage contact form: SMTP failed ($err), falling back to mail()");
}

$headers  = "From: $fromName <$from>\r\n";
if ($email !== '') {
    $headers .= "Reply-To: $email\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// -f sets the envelope sender to our own domain, which helps SPF checks.
if (mail($to, $subject, $body, $headers, "-f$from")) {
    respond('success', 'Message sent successfully');
}
respond('error', 'Mail function failed');

/**
 * Minimal authenticated SMTP client (SSL on 465 or STARTTLS on 587).
 * Returns null on success or an error string.
 */
function smtp_send($cfg, $to, $from, $fromName, $replyTo, $subject, $body) {
    $host   = $cfg['host'] ?? 'smtp.hostinger.com';
    $port   = (int) ($cfg['port'] ?? 465);
    $secure = $cfg['secure'] ?? 'ssl';          // 'ssl' (465), 'tls' (587) or 'none' (testing only)
    $user   = $cfg['username'] ?? $from;
    $pass   = $cfg['password'];

    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return "connect: $errstr ($errno)";
    }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = function ($line, $expect) use ($fp, $read) {
        if ($line !== null) {
            fwrite($fp, $line . "\r\n");
        }
        $res = $read();
        if ((int) substr($res, 0, 3) !== $expect) {
            return trim($res) === '' ? 'no response' : trim($res);
        }
        return null;
    };

    $helo = 'digitalngage.com';
    $steps = [[null, 220], ["EHLO $helo", 250]];
    foreach ($steps as $s) {
        if ($e = $cmd($s[0], $s[1])) { fclose($fp); return $e; }
    }
    if ($secure === 'tls') {
        if ($e = $cmd('STARTTLS', 220)) { fclose($fp); return $e; }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return 'starttls failed'; }
        if ($e = $cmd("EHLO $helo", 250)) { fclose($fp); return $e; }
    }

    $date = date('r');
    $msgId = '<' . bin2hex(random_bytes(12)) . '@digitalngage.com>';
    $head  = "Date: $date\r\n";
    $head .= "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$from>\r\n";
    $head .= "To: <$to>\r\n";
    if ($replyTo !== '') {
        $head .= "Reply-To: <$replyTo>\r\n";
    }
    $head .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $head .= "Message-ID: $msgId\r\n";
    $head .= "MIME-Version: 1.0\r\n";
    $head .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $head .= "Content-Transfer-Encoding: base64\r\n";
    $data = $head . "\r\n" . chunk_split(base64_encode($body), 76, "\r\n");

    $steps = [
        ['AUTH LOGIN', 334],
        [base64_encode($user), 334],
        [base64_encode($pass), 235],
        ["MAIL FROM:<$from>", 250],
        ["RCPT TO:<$to>", 250],
        ['DATA', 354],
        [$data . "\r\n.", 250],
    ];
    foreach ($steps as $i => $s) {
        if ($e = $cmd($s[0], $s[1])) {
            fclose($fp);
            return $i <= 2 ? 'login failed: ' . $e : $e;
        }
    }
    fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return null;
}
