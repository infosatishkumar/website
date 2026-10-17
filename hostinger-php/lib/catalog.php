<?php
// App directory (generated from src/lib/flowforge/catalog.ts into catalog.json).
declare(strict_types=1);

function ff_catalog(): array {
    static $cat = null;
    return $cat ??= json_decode(file_get_contents(__DIR__ . '/catalog.json'), true);
}

function ff_app(string $key): ?array {
    foreach (ff_catalog()['apps'] as $a) if ($a['key'] === $key) return $a;
    return null;
}

function ff_op(string $app, string $kind, string $op): ?array {
    $def = ff_app($app);
    foreach (($kind === 'trigger' ? ($def['triggers'] ?? []) : ($def['actions'] ?? [])) as $o) {
        if ($o['key'] === $op) return $o;
    }
    return null;
}
