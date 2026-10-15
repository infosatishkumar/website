<?php
declare(strict_types=1);

use Anthropic\Client;

/*
 * The AI Agent: chats with the owner, writes posts and — with permission —
 * publishes them through the same publish_post() path the dashboard uses.
 */

const AGENT_MAX_STEPS = 8;

function agent_tools(): array
{
    return [
        [
            'name' => 'list_accounts',
            'description' => 'List the connected social accounts (id, network, name). Call this before creating a post so you use real account ids.',
            'inputSchema' => ['type' => 'object', 'properties' => new stdClass()],
        ],
        [
            'name' => 'create_post',
            'description' => 'Create a social media post for one or more connected accounts. '
                . 'Instagram, Pinterest and TikTok need at least one image or video URL; YouTube needs a video. '
                . 'If auto-publish is off, the post is saved as "pending" for the owner to approve, whatever "when" says.',
            'inputSchema' => [
                'type' => 'object',
                'properties' => [
                    'account_ids' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Ids from list_accounts.'],
                    'text' => ['type' => 'string', 'description' => 'The caption, ready to post.'],
                    'image_urls' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Public image URLs the owner uploaded in this chat.'],
                    'when' => ['type' => 'string', 'enum' => ['now', 'schedule', 'draft'], 'description' => 'Publish now, schedule, or keep as draft.'],
                    'scheduled_at' => ['type' => 'string', 'description' => 'ISO-8601 time with timezone offset, required when when=schedule.'],
                ],
                'required' => ['account_ids', 'text', 'when'],
            ],
        ],
        [
            'name' => 'list_recent_posts',
            'description' => 'List the 15 most recent posts with their status and any publishing errors.',
            'inputSchema' => ['type' => 'object', 'properties' => new stdClass()],
        ],
    ];
}

function agent_system_prompt(): string
{
    $auto = user_setting('autopublish', '0') === '1';
    $name = current_user()['name'] ?? 'there';
    return "You are the AI Agent inside Social Media Connector, a social media management dashboard. "
        . "You are talking to $name. You help them plan, write and publish posts to their connected social accounts (Facebook, Instagram, LinkedIn, X, Threads, Pinterest, TikTok, YouTube, Google Business, Bluesky).\n\n"
        . "How to work:\n"
        . "- Reply in the language the owner writes in (Hindi, Hinglish or English).\n"
        . "- Write captions that fit each network: Instagram gets line breaks, emojis in moderation and 5–10 relevant hashtags; Facebook gets a shorter, conversational caption; X stays under 280 characters; Bluesky under 300; LinkedIn is professional.\n"
        . "- When the owner wants a post made, call list_accounts, then create_post. If networks need different captions, create one post per network.\n"
        . "- Instagram, Pinterest and TikTok cannot post text alone and YouTube needs a video. If media is missing for those, ask the owner to attach it.\n"
        . "- Only use image URLs the owner attached in this conversation.\n"
        . ($auto
            ? "- Auto-publish is ON: create_post with when=now publishes immediately. Only publish when the owner clearly asked you to post or publish; otherwise use when=draft and show them the caption.\n"
            : "- Auto-publish is OFF: every post you create waits in Approvals for the owner. Tell them it is waiting for their approval.\n")
        . "- After a tool runs, tell the owner briefly what happened, including any error message from the network.\n"
        . "- The owner's timezone is Asia/Kolkata unless they say otherwise. Current time (UTC): " . now_iso() . ".";
}

function agent_run_tool(string $name, array $input): string
{
    $pdo = db();
    if ($name === 'list_accounts') {
        $q = $pdo->prepare('SELECT id, network, name, handle FROM accounts WHERE user_id = ? ORDER BY id');
        $q->execute([uid()]);
        $rows = $q->fetchAll();
        return $rows ? json_encode($rows) : 'No accounts are connected yet. Ask the owner to connect an account on the Accounts page.';
    }
    if ($name === 'list_recent_posts') {
        $q = $pdo->prepare('SELECT id, text, account_ids, status, scheduled_at, result FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 15');
        $q->execute([uid()]);
        $rows = $q->fetchAll();
        return json_encode($rows);
    }
    if ($name === 'create_post') {
        $ids = array_values(array_filter(array_map('strval', (array) ($input['account_ids'] ?? []))));
        $text = trim((string) ($input['text'] ?? ''));
        $media = array_values(array_filter((array) ($input['image_urls'] ?? []), 'is_own_upload'));
        $when = (string) ($input['when'] ?? 'draft');
        if (!$ids || $text === '') {
            return 'Error: account_ids and text are required.';
        }
        $k = $pdo->prepare('SELECT id, network FROM accounts WHERE user_id = ?');
        $k->execute([uid()]);
        $known = $k->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach ($ids as $id) {
            if (!isset($known[$id])) {
                return "Error: account $id does not exist. Call list_accounts.";
            }
            if (in_array($known[$id], ['instagram', 'pinterest', 'tiktok', 'youtube'], true) && !$media) {
                return 'Error: ' . ucfirst($known[$id]) . ' needs an image or video. Ask the owner to attach one.';
            }
        }
        $at = now_iso();
        if ($when === 'schedule') {
            $ts = strtotime((string) ($input['scheduled_at'] ?? ''));
            if (!$ts || $ts < time()) {
                return 'Error: scheduled_at must be a valid future time.';
            }
            $at = gmdate('Y-m-d\TH:i:s\Z', $ts);
        }
        $auto = user_setting('autopublish', '0') === '1';
        $status = match (true) {
            $when === 'draft' => 'draft',
            !$auto => 'pending',
            $when === 'schedule' => 'scheduled',
            default => 'scheduled', // "now" → published right below
        };
        $pdo->prepare('INSERT INTO posts (user_id, text, account_ids, media, scheduled_at, status, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([uid(), $text, json_encode($ids), json_encode($media), $at, $status, 'AI Agent', now_iso()]);
        $postId = (int) $pdo->lastInsertId();
        $GLOBALS['agent_created_posts'][] = (string) $postId;

        if ($auto && $when === 'now') {
            $post = publish_post($postId);
            return 'Post ' . $postId . ' publish result: ' . $post['status'] . ' ' . $post['result'];
        }
        return "Post $postId saved with status \"$status\"" . ($status === 'scheduled' ? " for $at" : '') . '.';
    }
    return "Error: unknown tool $name";
}

/** Only allow images uploaded to this site, so the agent can't post arbitrary URLs. */
function is_own_upload(mixed $url): bool
{
    return is_string($url) && str_starts_with($url, rtrim(config()['base_url'], '/') . '/uploads/');
}

function image_block(string $url): ?array
{
    if (!is_own_upload($url)) {
        return null;
    }
    $file = dirname(__DIR__, 2) . '/uploads/' . basename(parse_url($url, PHP_URL_PATH));
    if (!is_file($file)) {
        return null;
    }
    $mime = mime_content_type($file) ?: 'image/jpeg';
    return ['type' => 'image', 'source' => ['type' => 'base64', 'mediaType' => $mime, 'data' => base64_encode((string) file_get_contents($file))]];
}

/** Lists the current user's chats, newest first. */
function agent_threads(): array
{
    $s = db()->prepare('SELECT id, title, updated_at FROM agent_threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50');
    $s->execute([uid()]);
    return array_map(fn ($r) => ['id' => (string) $r['id'], 'title' => $r['title'], 'updatedAt' => $r['updated_at']], $s->fetchAll());
}

function agent_load_thread(int $id): array
{
    $s = db()->prepare('SELECT * FROM agent_threads WHERE id = ? AND user_id = ?');
    $s->execute([$id, uid()]);
    $row = $s->fetch();
    if (!$row) {
        return ['id' => null, 'title' => 'New chat', 'history' => [], 'transcript' => []];
    }
    return [
        'id' => (int) $row['id'],
        'title' => $row['title'],
        'history' => json_decode((string) $row['history'], true) ?: [],
        'transcript' => json_decode($row['transcript'], true) ?: [],
    ];
}

function agent_save_thread(array &$thread): void
{
    $pdo = db();
    if ($thread['id']) {
        $pdo->prepare('UPDATE agent_threads SET history = ?, transcript = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            ->execute([json_encode($thread['history']), json_encode($thread['transcript']), now_iso(), $thread['id'], uid()]);
    } else {
        $pdo->prepare('INSERT INTO agent_threads (user_id, title, history, transcript, updated_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([uid(), $thread['title'], json_encode($thread['history']), json_encode($thread['transcript']), now_iso()]);
        $thread['id'] = (int) $pdo->lastInsertId();
    }
}

function claude_client(): Client
{
    $key = (string) (config()['anthropic_api_key'] ?? '');
    if ($key === '') {
        throw new RuntimeException('AI features are not set up yet. The site owner can add the Claude API key in Settings → Platform settings.');
    }
    return new Client(apiKey: $key);
}

/** Runs one message through the agent loop and returns the updated chat. */
function agent_message(?int $threadId, string $text, array $images): array
{
    $client = claude_client();
    use_ai_credit();
    @set_time_limit(300);

    $thread = $threadId ? agent_load_thread($threadId) : ['id' => null, 'title' => 'New chat', 'history' => [], 'transcript' => []];
    if (!$thread['id']) {
        $thread['title'] = mb_strimwidth(preg_replace('/\s+/', ' ', $text) ?? $text, 0, 60, '…');
    }
    $images = array_values(array_filter($images, 'is_own_upload'));

    $content = [];
    foreach ($images as $url) {
        if ($block = image_block($url)) {
            $content[] = $block;
        }
    }
    $note = $images ? "\n\n[Attached image URLs: " . implode(', ', $images) . ']' : '';
    $content[] = ['type' => 'text', 'text' => $text . $note];
    $thread['history'][] = ['role' => 'user', 'content' => $content];
    $thread['transcript'][] = ['role' => 'user', 'text' => $text, 'images' => $images, 'at' => now_iso()];

    $GLOBALS['agent_created_posts'] = [];
    $reply = '';
    for ($step = 0; $step < AGENT_MAX_STEPS; $step++) {
        $response = $client->beta->messages->create(
            model: config()['anthropic_model'],
            maxTokens: 16000,
            system: agent_system_prompt(),
            messages: $thread['history'],
            tools: agent_tools(),
            outputConfig: ['effort' => 'medium'],
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
        );
        // Keep the full content (thinking, fallback and tool blocks) so the next turn stays valid.
        $thread['history'][] = ['role' => 'assistant', 'content' => $response->content];
        foreach ($response->content as $block) {
            if ($block->type === 'text') {
                $reply .= ($reply === '' ? '' : "\n\n") . $block->text;
            }
        }
        if ($response->stopReason === 'refusal') {
            $reply = $reply ?: 'Sorry, I can’t help with that request.';
            break;
        }
        if ($response->stopReason !== 'tool_use') {
            break;
        }
        $results = [];
        foreach ($response->content as $block) {
            if ($block->type !== 'tool_use') {
                continue;
            }
            try {
                $results[] = ['type' => 'tool_result', 'toolUseID' => $block->id, 'content' => agent_run_tool($block->name, (array) $block->input)];
            } catch (Throwable $e) {
                $results[] = ['type' => 'tool_result', 'toolUseID' => $block->id, 'content' => 'Error: ' . $e->getMessage(), 'isError' => true];
            }
        }
        $thread['history'][] = ['role' => 'user', 'content' => $results];
    }

    $thread['transcript'][] = ['role' => 'assistant', 'text' => $reply !== '' ? $reply : 'Done.', 'postIds' => $GLOBALS['agent_created_posts'], 'at' => now_iso()];
    agent_save_thread($thread);
    return ['threadId' => (string) $thread['id'], 'title' => $thread['title'], 'transcript' => $thread['transcript'], 'credits' => ai_credits_left()];
}

/** AI Pilot: three caption options for the composer. */
function ai_captions(string $idea, string $tone, array $networks): array
{
    $client = claude_client();
    use_ai_credit();
    $nets = $networks ? implode(', ', array_map('strval', $networks)) : 'Facebook, Instagram, LinkedIn and X';
    $response = $client->beta->messages->create(
        model: config()['anthropic_model'],
        maxTokens: 4000,
        system: 'You write social media captions for small businesses. Match the language the user writes in (Hindi, Hinglish or English).',
        messages: [[
            'role' => 'user',
            'content' => "Write 3 different captions for: $idea\nTone: $tone\nNetworks: $nets\nKeep each under 600 characters, add a clear call to action and 3–6 relevant hashtags.",
        ]],
        outputConfig: [
            'effort' => 'low',
            'format' => [
                'type' => 'json_schema',
                'schema' => [
                    'type' => 'object',
                    'properties' => ['captions' => ['type' => 'array', 'items' => ['type' => 'string']]],
                    'required' => ['captions'],
                    'additionalProperties' => false,
                ],
            ],
        ],
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
    );
    if ($response->stopReason === 'refusal') {
        fail('The AI could not write captions for this idea. Try rephrasing it.');
    }
    foreach ($response->content as $block) {
        if ($block->type === 'text') {
            $data = json_decode($block->text, true);
            return ['captions' => array_slice(array_values(array_filter((array) ($data['captions'] ?? []), 'is_string')), 0, 3), 'credits' => ai_credits_left()];
        }
    }
    fail('The AI returned no captions. Please try again.');
}
