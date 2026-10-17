<?php
// Connections (encrypted credentials) and one executor per app action.
declare(strict_types=1);

function ff_public_connection(array $c): array { unset($c['secret']); return $c; }

function ff_save_connection(string $app, string $label, array $secret, ?array $meta = null, ?int $expiresAt = null): array {
    $conn = [
        'id' => ff_id('conn'),
        'app' => $app,
        'label' => $label,
        'secret' => ff_encrypt($secret),
        'meta' => $meta,
        'createdAt' => gmdate('c'),
        'expiresAt' => $expiresAt ? gmdate('c', $expiresAt) : null,
    ];
    ff_update('connections', function ($all) use ($conn) { $all[$conn['id']] = $conn; return $all; });
    return $conn;
}

/** Decrypts a connection's credentials, refreshing OAuth tokens close to expiry. */
function ff_creds(?string $connId, string $app): array {
    $def = ff_app($app);
    if (!$connId) throw new RuntimeException('Choose a ' . ($def['name'] ?? $app) . ' account for this step.');
    $conn = ff_read('connections')[$connId] ?? null;
    if (!$conn) throw new RuntimeException('The selected account was disconnected. Pick another one.');
    if ($conn['app'] !== $app) throw new RuntimeException('The selected account belongs to a different app.');
    $secret = ff_decrypt($conn['secret']);

    $p = $def['oauth'] ?? null;
    $exp = $conn['expiresAt'] ? strtotime($conn['expiresAt']) : null;
    $due = $exp && ($exp - time() < 600 || (in_array($p, ['instagram', 'threads'], true) && $exp - time() < 7 * 86400));
    if ($p && $due) {
        $c = ff_provider_creds($p);
        $r = $c ? ff_oauth_refresh($p, $c, $secret) : null;
        if ($r) {
            [$secret, $newExp] = $r;
            ff_update('connections', function ($all) use ($connId, $secret, $newExp) {
                $all[$connId]['secret'] = ff_encrypt($secret);
                if ($newExp) $all[$connId]['expiresAt'] = gmdate('c', $newExp);
                return $all;
            });
        } elseif ($exp < time()) {
            throw new RuntimeException($def['name'] . ' access expired. Reconnect the account.');
        }
    }
    return $secret;
}

function ff_need(array $cfg, string ...$keys): void {
    foreach ($keys as $k) if (trim((string) ($cfg[$k] ?? '')) === '') throw new RuntimeException("\"$k\" is empty for this step.");
}

function ff_linkedin_escape(string $s): string { return preg_replace('/([\\\\|{}@\[\]()<>#*_~])/', '\\\\$1', $s); }

function ff_bluesky_session(array $c): array {
    $service = rtrim($c['service'] ?? '' ?: 'https://bsky.social', '/');
    $s = ff_json_post('Bluesky login', "$service/xrpc/com.atproto.server.createSession", ['identifier' => $c['identifier'], 'password' => $c['appPassword']], [], true);
    return ['service' => $service, 'jwt' => $s['accessJwt'], 'did' => $s['did'], 'handle' => $s['handle']];
}

function ff_wait_container(string $url, string $field, string $token): void {
    for ($i = 0; $i < 15; $i++) {
        $s = ff_get_json('Media status', $url, ['fields' => $field, 'access_token' => $token]);
        if (($s[$field] ?? '') === 'FINISHED') return;
        if (in_array($s[$field] ?? '', ['ERROR', 'EXPIRED'], true)) throw new RuntimeException('Media processing failed: ' . json_encode($s));
        sleep(2);
    }
    throw new RuntimeException('Media is still processing after 30s; try a smaller image.');
}

function ff_parse_json_field(?string $raw, string $what): array {
    if (trim((string) $raw) === '') return [];
    $v = json_decode($raw, true);
    if (!is_array($v)) throw new RuntimeException("$what is not valid JSON.");
    return $v;
}

function ff_execute(string $app, string $op, array $cfg, ?string $connId) {
    switch ("$app.$op") {
        case 'http.request': {
            ff_need($cfg, 'url');
            $method = strtoupper($cfg['method'] ?? '' ?: 'POST');
            $headers = ff_parse_json_field($cfg['headers'] ?? '', 'Headers');
            $body = trim($cfg['body'] ?? '');
            $hasBody = !in_array($method, ['GET', 'DELETE'], true) && $body !== '';
            $lines = [];
            $hasType = false;
            foreach ($headers as $k => $v) { $lines[] = "$k: $v"; if (strtolower($k) === 'content-type') $hasType = true; }
            if ($hasBody && !$hasType) $lines[] = 'Content-Type: ' . (preg_match('/^\s*[\[{]/', $body) ? 'application/json' : 'text/plain');
            [$status, $h, $resp] = ff_http($method, $cfg['url'], $lines, $hasBody ? $body : null, true);
            $parsed = json_decode($resp, true);
            if ($status >= 400) throw new RuntimeException("HTTP $status: " . mb_substr($resp, 0, 500));
            return ['status' => $status, 'headers' => $h, 'body' => $parsed ?? $resp];
        }
        case 'formatter.compose': {
            $text = $cfg['template'] ?? '';
            $max = (int) ($cfg['maxLength'] ?? 0);
            if ($max > 0 && mb_strlen($text) > $max) $text = rtrim(mb_substr($text, 0, max(0, $max - 1))) . '…';
            return ['text' => $text, 'length' => mb_strlen($text)];
        }
        case 'claude.generate': {
            ff_need($cfg, 'prompt');
            $c = ff_creds($connId, 'claude');
            $model = $cfg['model'] ?? '' ?: 'claude-opus-5-5';
            $payload = [
                'model' => $model,
                'max_tokens' => 16000,
                'output_config' => ['effort' => $cfg['effort'] ?? '' ?: 'low'],
                'messages' => [['role' => 'user', 'content' => $cfg['prompt']]],
            ];
            if (trim($cfg['system'] ?? '') !== '') $payload['system'] = $cfg['system'];
            $headers = ['x-api-key: ' . $c['apiKey'], 'anthropic-version: 2023-06-01'];
            if (in_array($model, ['claude-opus-5-5', 'claude-sonnet-5-5'], true)) {
                $payload['fallbacks'] = 'default';
                $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
            }
            $r = ff_json_post('Claude', 'https://api.anthropic.com/v1/messages', $payload, $headers);
            if (($r['stop_reason'] ?? '') === 'refusal') throw new RuntimeException('Claude declined this request.');
            $text = '';
            foreach ($r['content'] ?? [] as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
            return ['text' => trim($text), 'model' => $r['model'] ?? $model, 'usage' => $r['usage'] ?? null];
        }
        case 'facebook.page_post': {
            ff_need($cfg, 'pageId', 'message');
            $c = ff_creds($connId, 'facebook');
            $token = $c['pageTokens'][$cfg['pageId']] ?? null;
            if (!$token) throw new RuntimeException('This Page is not part of the connected account. Reconnect Facebook.');
            $base = 'https://graph.facebook.com/' . FF_GRAPH . '/' . $cfg['pageId'];
            if (!empty($cfg['imageUrl'])) {
                return ff_form_post('Facebook photo', "$base/photos", ['url' => $cfg['imageUrl'], 'caption' => $cfg['message'], 'access_token' => $token]);
            }
            $f = ['message' => $cfg['message'], 'access_token' => $token];
            if (!empty($cfg['link'])) $f['link'] = $cfg['link'];
            return ff_form_post('Facebook post', "$base/feed", $f);
        }
        case 'instagram.publish_photo': {
            ff_need($cfg, 'imageUrl');
            $c = ff_creds($connId, 'instagram');
            $base = 'https://graph.instagram.com/' . $c['userId'];
            $box = ff_form_post('Instagram media container', "$base/media", ['image_url' => $cfg['imageUrl'], 'caption' => $cfg['caption'] ?? '', 'access_token' => $c['accessToken']]);
            ff_wait_container('https://graph.instagram.com/' . $box['id'], 'status_code', $c['accessToken']);
            return ff_form_post('Instagram publish', "$base/media_publish", ['creation_id' => $box['id'], 'access_token' => $c['accessToken']]);
        }
        case 'threads.create_post': {
            ff_need($cfg, 'text');
            $c = ff_creds($connId, 'threads');
            $base = 'https://graph.threads.net/v1.0/' . $c['userId'];
            $f = !empty($cfg['imageUrl'])
                ? ['media_type' => 'IMAGE', 'image_url' => $cfg['imageUrl'], 'text' => $cfg['text'], 'access_token' => $c['accessToken']]
                : ['media_type' => 'TEXT', 'text' => $cfg['text'], 'access_token' => $c['accessToken']];
            $box = ff_form_post('Threads container', "$base/threads", $f);
            if (!empty($cfg['imageUrl'])) ff_wait_container('https://graph.threads.net/v1.0/' . $box['id'], 'status', $c['accessToken']);
            return ff_form_post('Threads publish', "$base/threads_publish", ['creation_id' => $box['id'], 'access_token' => $c['accessToken']]);
        }
        case 'linkedin.create_post': {
            ff_need($cfg, 'text');
            $c = ff_creds($connId, 'linkedin');
            [$status, $h, $resp] = ff_http('POST', 'https://api.linkedin.com/rest/posts', [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $c['accessToken'],
                'LinkedIn-Version: ' . FF_LINKEDIN_VERSION,
                'X-Restli-Protocol-Version: 2.0.0',
            ], json_encode([
                'author' => $c['personUrn'],
                'commentary' => ff_linkedin_escape($cfg['text']),
                'visibility' => $cfg['visibility'] ?? '' ?: 'PUBLIC',
                'distribution' => ['feedDistribution' => 'MAIN_FEED', 'targetEntities' => [], 'thirdPartyDistributionChannels' => []],
                'lifecycleState' => 'PUBLISHED',
                'isReshareDisabledByAuthor' => false,
            ]));
            if ($status >= 300) throw new RuntimeException("LinkedIn post failed (HTTP $status): " . mb_substr($resp, 0, 500));
            return ['id' => $h['x-restli-id'] ?? null];
        }
        case 'x.create_post': {
            ff_need($cfg, 'text');
            $c = ff_creds($connId, 'x');
            return ff_json_post('X post', 'https://api.x.com/2/tweets', ['text' => $cfg['text']], ['Authorization: Bearer ' . $c['accessToken']])['data'] ?? [];
        }
        case 'pinterest.create_pin': {
            ff_need($cfg, 'boardId', 'imageUrl');
            $c = ff_creds($connId, 'pinterest');
            $pin = array_filter([
                'board_id' => $cfg['boardId'],
                'title' => $cfg['title'] ?? null,
                'description' => $cfg['description'] ?? null,
                'link' => $cfg['link'] ?? null,
            ]);
            $pin['media_source'] = ['source_type' => 'image_url', 'url' => $cfg['imageUrl']];
            return ff_json_post('Pinterest pin', 'https://api.pinterest.com/v5/pins', $pin, ['Authorization: Bearer ' . $c['accessToken']]);
        }
        case 'bluesky.create_post': {
            ff_need($cfg, 'text');
            $s = ff_bluesky_session(ff_creds($connId, 'bluesky'));
            $record = ['$type' => 'app.bsky.feed.post', 'text' => $cfg['text'], 'createdAt' => gmdate('Y-m-d\TH:i:s.v\Z')];
            $facets = [];
            if (preg_match_all('#https?://[^\s)]+#', $cfg['text'], $m, PREG_OFFSET_CAPTURE)) {
                // preg offsets are byte offsets, which is what Bluesky facets use.
                foreach ($m[0] as [$url, $start]) {
                    $facets[] = ['index' => ['byteStart' => $start, 'byteEnd' => $start + strlen($url)], 'features' => [['$type' => 'app.bsky.richtext.facet#link', 'uri' => $url]]];
                }
            }
            if ($facets) $record['facets'] = $facets;
            return ff_json_post('Bluesky post', $s['service'] . '/xrpc/com.atproto.repo.createRecord', ['repo' => $s['did'], 'collection' => 'app.bsky.feed.post', 'record' => $record], ['Authorization: Bearer ' . $s['jwt']], true);
        }
        case 'mastodon.post_status': {
            ff_need($cfg, 'status');
            $c = ff_creds($connId, 'mastodon');
            $r = ff_json_post('Mastodon post', rtrim($c['instance'], '/') . '/api/v1/statuses', ['status' => $cfg['status'], 'visibility' => $cfg['visibility'] ?? '' ?: 'public'], ['Authorization: Bearer ' . $c['accessToken']], true);
            return ['id' => $r['id'] ?? null, 'url' => $r['url'] ?? null];
        }
        case 'telegram.send_message': {
            ff_need($cfg, 'chatId', 'text');
            $c = ff_creds($connId, 'telegram');
            $p = ['chat_id' => $cfg['chatId'], 'text' => $cfg['text']];
            if (!empty($cfg['parseMode']) && $cfg['parseMode'] !== 'none') $p['parse_mode'] = $cfg['parseMode'];
            return ff_json_post('Telegram message', 'https://api.telegram.org/bot' . $c['botToken'] . '/sendMessage', $p)['result'] ?? [];
        }
        case 'telegram.send_photo': {
            ff_need($cfg, 'chatId', 'photoUrl');
            $c = ff_creds($connId, 'telegram');
            return ff_json_post('Telegram photo', 'https://api.telegram.org/bot' . $c['botToken'] . '/sendPhoto', ['chat_id' => $cfg['chatId'], 'photo' => $cfg['photoUrl'], 'caption' => $cfg['caption'] ?? ''])['result'] ?? [];
        }
        case 'whatsapp.send_template': {
            ff_need($cfg, 'to', 'template');
            $c = ff_creds($connId, 'whatsapp');
            $params = array_values(array_filter(array_map('trim', explode("\n", $cfg['params'] ?? ''))));
            $tpl = ['name' => $cfg['template'], 'language' => ['code' => $cfg['language'] ?? '' ?: 'en_US']];
            if ($params) $tpl['components'] = [['type' => 'body', 'parameters' => array_map(fn($t) => ['type' => 'text', 'text' => $t], $params)]];
            return ff_json_post('WhatsApp template', 'https://graph.facebook.com/' . FF_GRAPH . '/' . $c['phoneNumberId'] . '/messages', ['messaging_product' => 'whatsapp', 'to' => preg_replace('/\D/', '', $cfg['to']), 'type' => 'template', 'template' => $tpl], ['Authorization: Bearer ' . $c['accessToken']]);
        }
        case 'whatsapp.send_text': {
            ff_need($cfg, 'to', 'body');
            $c = ff_creds($connId, 'whatsapp');
            return ff_json_post('WhatsApp message', 'https://graph.facebook.com/' . FF_GRAPH . '/' . $c['phoneNumberId'] . '/messages', ['messaging_product' => 'whatsapp', 'to' => preg_replace('/\D/', '', $cfg['to']), 'type' => 'text', 'text' => ['body' => $cfg['body']]], ['Authorization: Bearer ' . $c['accessToken']]);
        }
        case 'discord.send_message': {
            ff_need($cfg, 'content');
            $c = ff_creds($connId, 'discord');
            $url = $c['webhookUrl'] . (str_contains($c['webhookUrl'], '?') ? '&' : '?') . 'wait=true';
            $p = ['content' => mb_substr($cfg['content'], 0, 2000)];
            if (!empty($cfg['username'])) $p['username'] = $cfg['username'];
            $r = ff_json_post('Discord message', $url, $p, [], true);
            return ['id' => $r['id'] ?? null, 'channel_id' => $r['channel_id'] ?? null];
        }
        case 'slack.send_message': {
            ff_need($cfg, 'text');
            $c = ff_creds($connId, 'slack');
            ff_json_post('Slack message', $c['webhookUrl'], ['text' => $cfg['text']], [], true);
            return ['ok' => true];
        }
        case 'email.send': {
            ff_need($cfg, 'to', 'subject', 'html');
            $c = ff_creds($connId, 'email');
            $html = preg_match('/<[a-z][\s\S]*>/i', $cfg['html']) ? $cfg['html'] : nl2br(htmlspecialchars($cfg['html']));
            $p = ['from' => $c['from'], 'to' => array_values(array_filter(array_map('trim', explode(',', $cfg['to'])))), 'subject' => $cfg['subject'], 'html' => $html];
            if (!empty($cfg['replyTo'])) $p['reply_to'] = $cfg['replyTo'];
            return ff_json_post('Resend email', 'https://api.resend.com/emails', $p, ['Authorization: Bearer ' . $c['apiKey']]);
        }
        case 'google_sheets.append_row': {
            ff_need($cfg, 'spreadsheetId', 'values');
            $c = ff_creds($connId, 'google_sheets');
            $range = rawurlencode("'" . str_replace("'", "''", $cfg['sheet'] ?? '' ?: 'Sheet1') . "'!A1");
            $row = array_map('trim', explode("\n", $cfg['values']));
            return ff_json_post('Google Sheets append', 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode(trim($cfg['spreadsheetId'])) . "/values/$range:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", ['values' => [$row]], ['Authorization: Bearer ' . $c['accessToken']]);
        }
        case 'notion.create_page': {
            ff_need($cfg, 'databaseId', 'title');
            $c = ff_creds($connId, 'notion');
            $blocks = [];
            foreach (preg_split('/\n{2,}/', $cfg['content'] ?? '') as $para) {
                if (trim($para) === '') continue;
                $blocks[] = ['object' => 'block', 'type' => 'paragraph', 'paragraph' => ['rich_text' => [['type' => 'text', 'text' => ['content' => mb_substr(trim($para), 0, 2000)]]]]];
            }
            $r = ff_json_post('Notion page', 'https://api.notion.com/v1/pages', [
                'parent' => ['database_id' => str_replace('-', '', trim($cfg['databaseId']))],
                'properties' => [($cfg['titleProperty'] ?? '' ?: 'Name') => ['title' => [['text' => ['content' => $cfg['title']]]]]],
                'children' => $blocks,
            ], ['Authorization: Bearer ' . $c['token'], 'Notion-Version: 2022-06-28']);
            return ['id' => $r['id'] ?? null, 'url' => $r['url'] ?? null];
        }
        case 'airtable.create_record': {
            ff_need($cfg, 'baseId', 'table', 'fields');
            $c = ff_creds($connId, 'airtable');
            return ff_json_post('Airtable record', 'https://api.airtable.com/v0/' . rawurlencode(trim($cfg['baseId'])) . '/' . rawurlencode(trim($cfg['table'])), ['fields' => ff_parse_json_field($cfg['fields'], 'Fields'), 'typecast' => true], ['Authorization: Bearer ' . $c['token']]);
        }
    }
    throw new RuntimeException("Unknown action $app.$op");
}

/** Checks pasted credentials against the real API; returns [label, meta]. */
function ff_verify_token(string $app, array $c): array {
    switch ($app) {
        case 'claude':
            ff_api('Anthropic key check', 'GET', 'https://api.anthropic.com/v1/models/claude-opus-5-5', ['x-api-key: ' . $c['apiKey'], 'anthropic-version: 2023-06-01']);
            return ['Anthropic key …' . substr($c['apiKey'], -4), null];
        case 'telegram':
            $r = ff_api('Telegram getMe', 'GET', 'https://api.telegram.org/bot' . $c['botToken'] . '/getMe');
            return ['@' . $r['result']['username'], ['username' => $r['result']['username']]];
        case 'bluesky':
            return ['@' . ff_bluesky_session($c)['handle'], null];
        case 'mastodon':
            $r = ff_api('Mastodon verify', 'GET', rtrim($c['instance'], '/') . '/api/v1/accounts/verify_credentials', ['Authorization: Bearer ' . $c['accessToken']], null, true);
            return ['@' . $r['acct'] . '@' . parse_url($c['instance'], PHP_URL_HOST), null];
        case 'whatsapp':
            $r = ff_api('WhatsApp verify', 'GET', 'https://graph.facebook.com/' . FF_GRAPH . '/' . $c['phoneNumberId'] . '?fields=display_phone_number,verified_name', ['Authorization: Bearer ' . $c['accessToken']]);
            return [trim(($r['verified_name'] ?? 'WhatsApp') . ' ' . ($r['display_phone_number'] ?? '')), null];
        case 'discord':
            if (!preg_match('#^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/#', $c['webhookUrl'])) throw new RuntimeException("That doesn't look like a Discord webhook URL.");
            $r = ff_api('Discord verify', 'GET', $c['webhookUrl'], [], null, true);
            return ['Discord · ' . ($r['name'] ?? 'webhook'), null];
        case 'slack':
            if (!str_starts_with($c['webhookUrl'], 'https://hooks.slack.com/')) throw new RuntimeException('Slack webhook URLs start with https://hooks.slack.com/');
            return ['Slack webhook', null];
        case 'email':
            if (!str_starts_with($c['apiKey'], 're_')) throw new RuntimeException('Resend API keys start with re_');
            return [$c['from'], null];
        case 'notion':
            $r = ff_api('Notion verify', 'GET', 'https://api.notion.com/v1/users/me', ['Authorization: Bearer ' . $c['token'], 'Notion-Version: 2022-06-28']);
            return ['Notion · ' . ($r['name'] ?? 'integration'), null];
        case 'airtable':
            $r = ff_api('Airtable verify', 'GET', 'https://api.airtable.com/v0/meta/whoami', ['Authorization: Bearer ' . $c['token']]);
            return ['Airtable · ' . ($r['email'] ?? $r['id'] ?? ''), null];
    }
    return [$app, null];
}

function ff_telegram_webhook(string $connId, ?string $url, string $secret = ''): void {
    $c = ff_creds($connId, 'telegram');
    $endpoint = $url ? 'setWebhook' : 'deleteWebhook';
    ff_json_post("Telegram $endpoint", 'https://api.telegram.org/bot' . $c['botToken'] . "/$endpoint", $url ? ['url' => $url, 'secret_token' => $secret, 'allowed_updates' => ['message', 'channel_post']] : (object) []);
}
