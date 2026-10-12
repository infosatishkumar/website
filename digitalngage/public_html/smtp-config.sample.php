<?php
/*
 * SMTP settings for the contact form (contact.php).
 *
 * 1. Copy this file and name the copy  smtp-config.php
 * 2. Put the copy ONE FOLDER ABOVE public_html (next to the public_html folder,
 *    not inside it) so it can never be opened in a browser.
 * 3. Type the password of the no-reply@digitalngage.com mailbox below.
 *
 * Never share this password in chat or email. If the password of the mailbox
 * is changed in Hostinger, update it here too.
 */
return [
    'host'     => 'smtp.hostinger.com',
    'port'     => 465,
    'secure'   => 'ssl',
    'username' => 'no-reply@digitalngage.com',
    'password' => '',   // <-- no-reply mailbox password
];
