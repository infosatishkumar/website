<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

/* Transactional email through the Hostinger mailbox in smc-config.php (SMTP). */

function send_mail(string $to, string $subject, string $html, string $text): void
{
    $cfg = config();
    if (empty($cfg['smtp_user']) || empty($cfg['smtp_pass'])) {
        throw new RuntimeException('Email is not set up yet: add smtp_user and smtp_pass to smc-config.php.');
    }
    $m = new PHPMailer(true);
    $m->isSMTP();
    $m->Host = (string) $cfg['smtp_host'];
    $m->Port = (int) $cfg['smtp_port'];
    $m->SMTPAuth = true;
    $m->Username = (string) $cfg['smtp_user'];
    $m->Password = (string) $cfg['smtp_pass'];
    $port = (int) $cfg['smtp_port'];
    if ($port === 465) {
        $m->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($port === 587) {
        $m->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $m->SMTPAutoTLS = false; // plain SMTP (local testing)
    }
    $m->CharSet = 'UTF-8';
    $m->setFrom((string) ($cfg['mail_from'] ?: $cfg['smtp_user']), (string) $cfg['mail_from_name']);
    $m->addAddress($to);
    $m->isHTML(true);
    $m->Subject = $subject;
    $m->Body = $html;
    $m->AltBody = $text;
    $m->send();
}

/** Branded email layout in the Social Media Connector style. */
function email_layout(string $title, string $intro, ?string $buttonText, ?string $url, string $footnote = ''): string
{
    $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES);
    $button = $buttonText && $url
        ? '<tr><td align="center" style="padding:28px 0 8px"><a href="' . $e($url) . '" style="background:#673DE6;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 34px;border-radius:8px;display:inline-block">' . $e($buttonText) . '</a></td></tr>'
          . '<tr><td style="padding-top:22px;font-size:14px;color:#36344D">Alternatively, you can do the same by clicking on the following URL:<br><a href="' . $e($url) . '" style="color:#673DE6;word-break:break-all">' . $e($url) . '</a></td></tr>'
        : '';
    return '<!doctype html><html><body style="margin:0;background:#F4F5FF;font-family:Arial,Helvetica,sans-serif">'
        . '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5FF;padding:32px 12px"><tr><td align="center">'
        . '<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">'
        . '<tr><td style="padding-bottom:18px"><table cellpadding="0" cellspacing="0"><tr>'
        . '<td style="background:#673DE6;border-radius:10px;width:40px;height:40px;text-align:center;color:#fff;font-weight:700;font-size:22px">C</td>'
        . '<td style="padding-left:10px;font-size:18px;font-weight:700;color:#1D1E20">Social Media<br><span style="font-size:11px;letter-spacing:3px;color:#673DE6">CONNECTOR</span></td>'
        . '</tr></table></td><td align="right" style="font-size:12px;font-style:italic;color:#6D7081">Plan, schedule &amp; manage your social media</td></tr>'
        . '<tr><td colspan="2" style="background:#ffffff;border-radius:12px;padding:36px">'
        . '<table width="100%" cellpadding="0" cellspacing="0">'
        . '<tr><td style="font-size:24px;font-weight:700;color:#1D1E20">' . $e($title) . '</td></tr>'
        . '<tr><td style="padding-top:14px;font-size:15px;line-height:1.6;color:#36344D">' . $intro . '</td></tr>'
        . $button
        . ($footnote ? '<tr><td style="padding-top:22px;font-size:12px;color:#6D7081">' . $footnote . '</td></tr>' : '')
        . '</table></td></tr>'
        . '<tr><td colspan="2" align="center" style="padding-top:18px;font-size:12px;color:#6D7081">Social Media Connector · ' . $e(parse_url(base_url(), PHP_URL_HOST) ?: '') . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}
