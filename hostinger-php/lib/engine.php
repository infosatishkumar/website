<?php
// Workflow engine: templates, filters, runs, schedule/RSS ticks.
declare(strict_types=1);

const FF_MAX_RUNS = 300;

function ff_resolve(array $ctx, string $path) {
    $path = preg_replace('/\[(\d+)\]/', '.$1', trim($path));
    $cur = $ctx;
    foreach (array_filter(explode('.', $path), 'strlen') as $p) {
        if (!is_array($cur) || !array_key_exists($p, $cur)) return null;
        $cur = $cur[$p];
    }
    return $cur;
}

function ff_render(?string $tpl, array $ctx): string {
    if ($tpl === null || $tpl === '') return '';
    return preg_replace_callback('/\{\{\s*([^}]+?)\s*\}\}/', function ($m) use ($ctx) {
        $v = ff_resolve($ctx, $m[1]);
        if ($v === null) return '';
        if (is_bool($v)) return $v ? 'true' : 'false';
        if (is_scalar($v)) return (string) $v;
        return json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }, $tpl);
}

function ff_check_filter(array $c): bool {
    $l = (string) ($c['left'] ?? '');
    $r = (string) ($c['right'] ?? '');
    switch ($c['operator'] ?? 'exists') {
        case 'exists': return trim($l) !== '';
        case 'does not exist': return trim($l) === '';
        case 'equals': return mb_strtolower(trim($l)) === mb_strtolower(trim($r));
        case 'does not equal': return mb_strtolower(trim($l)) !== mb_strtolower(trim($r));
        case 'contains': return str_contains(mb_strtolower($l), mb_strtolower($r));
        case 'does not contain': return !str_contains(mb_strtolower($l), mb_strtolower($r));
        case 'greater than': return is_numeric($l) && is_numeric($r) && (float) $l > (float) $r;
        case 'less than': return is_numeric($l) && is_numeric($r) && (float) $l < (float) $r;
    }
    return false;
}

function ff_trim_for_storage($v) {
    $s = json_encode($v);
    return ($s && strlen($s) > 20000) ? ['truncated' => true, 'preview' => substr($s, 0, 20000)] : $v;
}

/** Runs every step after the trigger and stores a run record. */
function ff_run_workflow(array $wf, $input, string $source): array {
    set_time_limit(120);
    $started = microtime(true);
    $ctx = [
        'trigger' => $input ?? [],
        'steps' => ['1' => $input],
        'now' => gmdate('c'),
        'today' => gmdate('Y-m-d'),
        'workflow' => ['id' => $wf['id'], 'name' => $wf['name']],
    ];
    $results = [];
    $status = 'success';
    $error = null;

    foreach (array_slice($wf['steps'], 1) as $i => $step) {
        $t = microtime(true);
        $base = ['stepId' => $step['id'], 'label' => $step['label'], 'app' => $step['app']];
        if ($status !== 'success') { $results[] = $base + ['status' => 'skipped', 'ms' => 0]; continue; }
        try {
            $cfg = [];
            foreach ($step['config'] ?? [] as $k => $v) $cfg[$k] = ff_render((string) $v, $ctx);
            if ($step['app'] === 'filter') {
                $passed = ff_check_filter($cfg);
                $output = ['passed' => $passed];
                if (!$passed) $status = 'filtered';
            } else {
                $def = ff_app($step['app']);
                if (($def['auth'] ?? 'none') !== 'none' && empty($step['connectionId'])) throw new RuntimeException('Connect a ' . $def['name'] . ' account for this step.');
                $output = ff_execute($step['app'], $step['op'], $cfg, $step['connectionId'] ?? null);
            }
            $ctx['steps'][(string) ($i + 2)] = $output;
            $ctx['steps'][$step['id']] = $output;
            $results[] = $base + ['status' => $status === 'filtered' ? 'stopped' : 'success', 'output' => ff_trim_for_storage($output), 'ms' => (int) ((microtime(true) - $t) * 1000)];
        } catch (Throwable $e) {
            $status = 'error';
            $error = $e->getMessage();
            $results[] = $base + ['status' => 'error', 'error' => $error, 'ms' => (int) ((microtime(true) - $t) * 1000)];
        }
    }

    $run = [
        'id' => ff_id('run'),
        'workflowId' => $wf['id'],
        'workflowName' => $wf['name'],
        'source' => $source,
        'status' => $status,
        'startedAt' => gmdate('c'),
        'ms' => (int) ((microtime(true) - $started) * 1000),
        'input' => ff_trim_for_storage($input),
        'steps' => $results,
        'error' => $error,
    ];
    ff_update('runs', function ($runs) use ($run) {
        array_unshift($runs, $run);
        return array_slice($runs, 0, FF_MAX_RUNS);
    });
    ff_update('workflows', function ($all) use ($wf) {
        if (isset($all[$wf['id']])) $all[$wf['id']]['runs'] = ($all[$wf['id']]['runs'] ?? 0) + 1;
        return $all;
    });
    return $run;
}

// -------------------------------------------------------------------- RSS --

function ff_xml_text(string $xml, string $tag): string {
    if (!preg_match('#<' . preg_quote($tag, '#') . '(?:\s[^>]*)?>([\s\S]*?)</' . preg_quote($tag, '#') . '>#i', $xml, $m)) return '';
    $v = preg_replace('/<!\[CDATA\[([\s\S]*?)\]\]>/', '$1', $m[1]);
    return trim(html_entity_decode($v, ENT_QUOTES | ENT_XML1 | ENT_HTML5, 'UTF-8'));
}

function ff_xml_attr(string $xml, string $tag, string $attr, ?string $must = null): string {
    if (!preg_match_all('#<' . preg_quote($tag, '#') . '\b([^>]*)/?>#i', $xml, $all)) return '';
    foreach ($all[1] as $attrs) {
        if ($must && !preg_match($must, $attrs)) continue;
        if (preg_match('/' . $attr . '\s*=\s*["\']([^"\']+)["\']/i', $attrs, $m)) return html_entity_decode($m[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
    return '';
}

function ff_strip(string $s): string { return trim(preg_replace('/\s+/', ' ', strip_tags($s))); }

function ff_parse_feed(string $xml): array {
    preg_match_all('#<(item|entry)\b[\s\S]*?</\1>#i', $xml, $m);
    $items = [];
    foreach ($m[0] as $b) {
        $link = ff_xml_text($b, 'link') ?: ff_xml_attr($b, 'link', 'href', '/rel=["\']alternate["\']/') ?: ff_xml_attr($b, 'link', 'href');
        $desc = ff_xml_text($b, 'description') ?: ff_xml_text($b, 'summary') ?: ff_xml_text($b, 'content') ?: ff_xml_text($b, 'media:description');
        $img = ff_xml_attr($b, 'media:thumbnail', 'url') ?: ff_xml_attr($b, 'media:content', 'url') ?: ff_xml_attr($b, 'enclosure', 'url');
        $items[] = array_filter([
            'id' => ff_xml_text($b, 'guid') ?: ff_xml_text($b, 'id') ?: $link,
            'title' => ff_strip(ff_xml_text($b, 'title')),
            'link' => $link,
            'description' => mb_substr(ff_strip($desc), 0, 2000),
            'published' => ff_xml_text($b, 'pubDate') ?: ff_xml_text($b, 'published') ?: ff_xml_text($b, 'updated'),
            'image' => $img ?: null,
        ], fn($v) => $v !== null);
    }
    return $items;
}

// ----------------------------------------------------------------- ticks --

/** One cron tick: fire due schedules and poll RSS feeds. */
function ff_tick(): array {
    $report = ['checked' => 0, 'fired' => [], 'errors' => []];
    foreach (ff_read('workflows') as $wf) {
        if (($wf['status'] ?? '') !== 'on') continue;
        $trig = $wf['steps'][0] ?? null;
        if (!$trig || !in_array($trig['app'], ['schedule', 'rss'], true)) continue;
        $report['checked']++;
        $state = $wf['state'] ?? [];
        try {
            if ($trig['app'] === 'schedule') {
                $minutes = max(1, (int) ($trig['config']['minutes'] ?? 60));
                if (time() - (int) ($state['lastFire'] ?? 0) >= $minutes * 60 - 30) {
                    ff_set_state($wf['id'], ['lastFire' => time()]);
                    $run = ff_run_workflow($wf, ['firedAt' => gmdate('c'), 'intervalMinutes' => $minutes], 'schedule');
                    $report['fired'][] = ['workflow' => $wf['name'], 'source' => 'schedule', 'status' => $run['status']];
                }
            } else {
                [$st, , $xml] = ff_http('GET', $trig['config']['feedUrl'] ?? '', [], null, true);
                if ($st >= 400) throw new RuntimeException("Feed returned HTTP $st");
                $items = ff_parse_feed($xml);
                $first = !isset($state['seen']);
                $seen = array_flip($state['seen'] ?? []);
                $fresh = array_values(array_filter($items, fn($i) => !empty($i['id']) && !isset($seen[$i['id']])));
                $nextSeen = array_slice(array_values(array_unique(array_merge(array_column($items, 'id'), $state['seen'] ?? []))), 0, 300);
                ff_set_state($wf['id'], ['seen' => $nextSeen, 'lastSample' => $items[0] ?? null]);
                // The first poll only remembers existing posts so old ones don't flood out.
                if (!$first) {
                    foreach (array_reverse(array_slice($fresh, 0, 5)) as $item) {
                        $run = ff_run_workflow($wf, $item, 'rss');
                        $report['fired'][] = ['workflow' => $wf['name'], 'source' => 'rss', 'status' => $run['status']];
                    }
                }
            }
        } catch (Throwable $e) {
            $report['errors'][] = ['workflow' => $wf['name'], 'error' => $e->getMessage()];
        }
    }
    return $report;
}

function ff_set_state(string $id, array $patch): void {
    ff_update('workflows', function ($all) use ($id, $patch) {
        if (isset($all[$id])) $all[$id]['state'] = array_merge($all[$id]['state'] ?? [], $patch);
        return $all;
    });
}

/** Keep a Telegram bot's webhook pointed at the workflow that uses it. */
function ff_sync_trigger(array $wf, ?array $prev): void {
    $t = $wf['steps'][0] ?? [];
    $pt = $prev['steps'][0] ?? [];
    $was = ($pt['app'] ?? '') === 'telegram' && ($prev['status'] ?? '') === 'on' && !empty($pt['connectionId']);
    $is = ($t['app'] ?? '') === 'telegram' && $wf['status'] === 'on' && !empty($t['connectionId']);
    if ($was && (!$is || $pt['connectionId'] !== $t['connectionId'])) {
        try { ff_telegram_webhook($pt['connectionId'], null); } catch (Throwable $e) {}
    }
    if ($is) {
        $base = ff_app_url();
        if (!str_starts_with($base, 'https://')) throw new RuntimeException('Telegram needs your site on https. Enable SSL in Hostinger first.');
        ff_telegram_webhook($t['connectionId'], "$base/hook.php?id={$wf['id']}", $wf['hookToken']);
    }
}
