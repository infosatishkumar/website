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

$headers  = "From: DigitalNgage Website <no-reply@digitalngage.com>\r\n";
if ($email !== '') {
    $headers .= "Reply-To: $email\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    respond('success', 'Message sent successfully');
}
respond('error', 'Mail function failed');
