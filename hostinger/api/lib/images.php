<?php
declare(strict_types=1);

/*
 * AI post images: Claude designs the graphic (headline, colours, badge, button),
 * PHP GD draws it as a PNG in /uploads. Works on any Hostinger plan (GD is built in).
 */

const IMAGE_SIZES = [
    'square' => [1080, 1080],
    'portrait' => [1080, 1350],
    'story' => [1080, 1920],
    'landscape' => [1200, 628],
];

/** JSON schema Claude fills in for a design (also the agent tool's input). */
function image_spec_schema(): array
{
    $hex = ['type' => 'string', 'description' => 'Hex colour like #673DE6'];
    return [
        'type' => 'object',
        'properties' => [
            'headline' => ['type' => 'string', 'description' => 'Big main text, max 60 characters. Latin script only (English or Hinglish), no emojis.'],
            'subtext' => ['type' => 'string', 'description' => 'Supporting line, max 120 characters, or empty.'],
            'badge' => ['type' => 'string', 'description' => 'Small label on top like "DIWALI OFFER" or "NEW", max 22 characters, or empty.'],
            'cta' => ['type' => 'string', 'description' => 'Button text like "Order now", max 24 characters, or empty.'],
            'footer' => ['type' => 'string', 'description' => 'Brand name, website or phone at the bottom, max 40 characters, or empty.'],
            'style' => ['type' => 'string', 'enum' => ['gradient', 'bold', 'minimal', 'photo'], 'description' => 'photo only when a background image URL is given.'],
            'align' => ['type' => 'string', 'enum' => ['center', 'left']],
            'size' => ['type' => 'string', 'enum' => array_keys(IMAGE_SIZES), 'description' => 'square for feed posts, portrait for Instagram, story for Reels/Stories, landscape for LinkedIn/X/Facebook links.'],
            'bg1' => $hex,
            'bg2' => $hex,
            'accent' => $hex,
            'text' => $hex,
        ],
        'required' => ['headline', 'subtext', 'badge', 'cta', 'footer', 'style', 'align', 'size', 'bg1', 'bg2', 'accent', 'text'],
        'additionalProperties' => false,
    ];
}

/** Claude turns a plain request into a design spec, then we draw it. */
function ai_image(string $prompt, string $size, string $background): array
{
    $prompt = trim($prompt);
    if ($prompt === '') {
        fail('Describe the image you want');
    }
    $client = claude_client();
    use_ai_credit();
    $extra = ($size !== '' ? "\nPreferred size: $size." : '') . ($background !== '' ? "\nA background photo is provided, so use style \"photo\"." : '');
    $response = $client->beta->messages->create(
        model: config()['anthropic_model'],
        maxTokens: 2000,
        system: 'You are a social media graphic designer. Design one eye-catching post graphic: a short punchy headline, optional supporting line, badge, button and footer, '
            . 'and a harmonious colour palette with strong contrast between text and background. Write all text in Latin script (English or Hinglish) with no emojis. '
            . 'Keep the brand, offer, prices and dates exactly as the user gives them; never invent phone numbers or websites.',
        messages: [['role' => 'user', 'content' => "Design a post image for: $prompt$extra"]],
        outputConfig: ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => image_spec_schema()]],
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
    );
    if ($response->stopReason === 'refusal') {
        fail('The AI could not design this image. Try rephrasing it.');
    }
    foreach ($response->content as $block) {
        if ($block->type === 'text') {
            $spec = json_decode($block->text, true) ?: [];
            if ($background !== '') {
                $spec['background'] = $background;
                $spec['style'] = 'photo';
            }
            if ($size !== '' && isset(IMAGE_SIZES[$size])) {
                $spec['size'] = $size;
            }
            return ['url' => render_post_image($spec), 'spec' => $spec, 'credits' => ai_credits_left()];
        }
    }
    fail('The AI returned no design. Please try again.');
}

/* ---------------- drawing ---------------- */

function font_path(string $weight): string
{
    return dirname(__DIR__) . '/fonts/DMSans_' . ['regular' => '400Regular', 'medium' => '500Medium', 'bold' => '700Bold'][$weight] . '.ttf';
}

function hex_rgb(string $hex, array $fallback): array
{
    $hex = ltrim(trim($hex), '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) {
        return $fallback;
    }
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

function luminance(array $c): float
{
    $f = function ($v) {
        $v /= 255;
        return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * $f($c[0]) + 0.7152 * $f($c[1]) + 0.0722 * $f($c[2]);
}

function contrast(array $a, array $b): float
{
    [$l1, $l2] = [luminance($a), luminance($b)];
    return (max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05);
}

/** Text the bundled font can draw: Latin, punctuation, ₹ → Rs. */
function image_text(string $s, int $max): string
{
    $s = str_replace(['₹', '’', '‘', '“', '”', '–', '—'], ['Rs.', "'", "'", '"', '"', '-', '-'], $s);
    $s = preg_replace('/[^\x{0020}-\x{007E}\x{00A0}-\x{017F}]/u', '', $s) ?? '';
    $s = trim(preg_replace('/\s+/', ' ', $s) ?? '');
    return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 1)) . '…' : $s;
}

function text_width(string $text, float $size, string $font): int
{
    $b = imagettfbbox($size, 0, $font, $text);
    return (int) abs($b[2] - $b[0]);
}

/** Greedy word wrap for a given width. */
function wrap_text(string $text, float $size, string $font, int $width): array
{
    $lines = [];
    $line = '';
    foreach (explode(' ', $text) as $word) {
        $try = $line === '' ? $word : "$line $word";
        if ($line !== '' && text_width($try, $size, $font) > $width) {
            $lines[] = $line;
            $line = $word;
        } else {
            $line = $try;
        }
    }
    if ($line !== '') {
        $lines[] = $line;
    }
    return $lines;
}

/** Largest size (down to $min) at which the text fits in $maxLines lines. */
function fit_text(string $text, float $start, float $min, string $font, int $width, int $maxLines): array
{
    for ($size = $start; $size > $min; $size -= 2) {
        $lines = wrap_text($text, $size, $font, $width);
        $widest = max(array_map(fn ($l) => text_width($l, $size, $font), $lines));
        if (count($lines) <= $maxLines && $widest <= $width) {
            return [$size, $lines];
        }
    }
    return [$min, array_slice(wrap_text($text, $min, $font, $width), 0, $maxLines)];
}

function color(GdImage $im, array $c, int $alpha = 0): int
{
    return imagecolorallocatealpha($im, $c[0], $c[1], $c[2], $alpha);
}

function rounded_rect(GdImage $im, int $x1, int $y1, int $x2, int $y2, int $r, int $col): void
{
    $r = min($r, (int) (($y2 - $y1) / 2), (int) (($x2 - $x1) / 2));
    imagefilledrectangle($im, $x1 + $r, $y1, $x2 - $r, $y2, $col);
    imagefilledrectangle($im, $x1, $y1 + $r, $x2, $y2 - $r, $col);
    foreach ([[$x1 + $r, $y1 + $r], [$x2 - $r, $y1 + $r], [$x1 + $r, $y2 - $r], [$x2 - $r, $y2 - $r]] as [$cx, $cy]) {
        imagefilledellipse($im, $cx, $cy, $r * 2, $r * 2, $col);
    }
}

/** Draws the spec and saves it to /uploads. Returns the public URL. */
function render_post_image(array $spec): string
{
    [$W, $H] = IMAGE_SIZES[$spec['size'] ?? 'square'] ?? IMAGE_SIZES['square'];
    $style = in_array($spec['style'] ?? '', ['gradient', 'bold', 'minimal', 'photo'], true) ? $spec['style'] : 'gradient';
    $bg1 = hex_rgb((string) ($spec['bg1'] ?? ''), [103, 61, 230]);
    $bg2 = hex_rgb((string) ($spec['bg2'] ?? ''), [47, 28, 106]);
    $accent = hex_rgb((string) ($spec['accent'] ?? ''), [255, 205, 53]);
    $text = hex_rgb((string) ($spec['text'] ?? ''), [255, 255, 255]);

    $im = imagecreatetruecolor($W, $H);
    imagealphablending($im, true);
    imagesavealpha($im, false);
    imageantialias($im, true);

    $photo = null;
    if ($style === 'photo' && !empty($spec['background'])) {
        $path = media_file((string) $spec['background']);
        $photo = @imagecreatefromstring((string) file_get_contents($path));
    }
    if ($photo) {
        // Cover-crop the photo, then darken the lower part so text stays readable.
        [$pw, $ph] = [imagesx($photo), imagesy($photo)];
        $scale = max($W / $pw, $H / $ph);
        $sw = (int) ($W / $scale);
        $sh = (int) ($H / $scale);
        imagecopyresampled($im, $photo, 0, 0, (int) (($pw - $sw) / 2), (int) (($ph - $sh) / 2), $W, $H, $sw, $sh);
        imagedestroy($photo);
        for ($y = 0; $y < $H; $y++) {
            $t = $y / $H;
            $a = (int) (127 - min(1, 0.35 + $t * 0.75) * 105);
            imagefilledrectangle($im, 0, $y, $W, $y, imagecolorallocatealpha($im, 10, 8, 25, max(0, $a)));
        }
        $base = [20, 18, 35];
    } elseif ($style === 'minimal') {
        imagefilledrectangle($im, 0, 0, $W, $H, color($im, $bg1));
        imagefilledrectangle($im, 0, $H - (int) ($H * 0.018), $W, $H, color($im, $accent));
        imagefilledellipse($im, (int) ($W * 0.92), (int) ($H * 0.1), (int) ($W * 0.22), (int) ($W * 0.22), color($im, $accent, 90));
        $base = $bg1;
    } else {
        // Diagonal-ish gradient: vertical blend plus soft light circles.
        for ($y = 0; $y < $H; $y++) {
            $t = $y / max(1, $H - 1);
            $c = [(int) ($bg1[0] + ($bg2[0] - $bg1[0]) * $t), (int) ($bg1[1] + ($bg2[1] - $bg1[1]) * $t), (int) ($bg1[2] + ($bg2[2] - $bg1[2]) * $t)];
            imagefilledrectangle($im, 0, $y, $W, $y, color($im, $c));
        }
        $big = (int) ($W * ($style === 'bold' ? 1.0 : 0.8));
        imagefilledellipse($im, (int) ($W * 0.95), (int) ($H * 0.08), $big, $big, color($im, $accent, $style === 'bold' ? 70 : 105));
        imagefilledellipse($im, (int) ($W * 0.05), (int) ($H * 0.98), (int) ($big * 0.7), (int) ($big * 0.7), color($im, [255, 255, 255], 112));
        if ($style === 'bold') {
            imagefilledellipse($im, (int) ($W * 0.12), (int) ($H * 0.2), (int) ($W * 0.12), (int) ($W * 0.12), color($im, $accent, 40));
        }
        $base = [(int) (($bg1[0] + $bg2[0]) / 2), (int) (($bg1[1] + $bg2[1]) / 2), (int) (($bg1[2] + $bg2[2]) / 2)];
    }

    // Keep text readable whatever colours the AI picked.
    if (contrast($text, $base) < 4.5) {
        $text = contrast([255, 255, 255], $base) >= contrast([17, 17, 17], $base) ? [255, 255, 255] : [17, 17, 17];
    }
    $ctaText = contrast([255, 255, 255], $accent) >= contrast([17, 17, 17], $accent) ? [255, 255, 255] : [17, 17, 17];

    $bold = font_path('bold');
    $medium = font_path('medium');
    $regular = font_path('regular');
    $pad = (int) ($W * 0.08);
    $inner = $W - 2 * $pad;
    $center = ($spec['align'] ?? 'center') !== 'left';
    $unit = min($W, $H) / 1080;

    $headline = image_text((string) ($spec['headline'] ?? ''), 70);
    $subtext = image_text((string) ($spec['subtext'] ?? ''), 140);
    $badge = mb_strtoupper(image_text((string) ($spec['badge'] ?? ''), 24));
    $cta = image_text((string) ($spec['cta'] ?? ''), 28);
    $footer = image_text((string) ($spec['footer'] ?? ''), 44);

    [$hSize, $hLines] = fit_text($headline !== '' ? $headline : 'Your headline', 104 * $unit * ($H > $W * 1.2 ? 1.2 : 1), 44 * $unit, $bold, $inner, $H > $W ? 5 : 4);
    [$sSize, $sLines] = $subtext !== '' ? fit_text($subtext, 40 * $unit, 26 * $unit, $regular, $inner, 3) : [0, []];
    $bSize = 26 * $unit;
    $cSize = 34 * $unit;

    // Measure the block so it sits in the middle (or lower third for photos).
    $hLine = $hSize * 1.22;
    $sLine = $sSize * 1.45;
    $blockH = ($badge !== '' ? $bSize * 2.6 + 30 * $unit : 0) + count($hLines) * $hLine + ($sLines ? 28 * $unit + count($sLines) * $sLine : 0) + ($cta !== '' ? 48 * $unit + $cSize * 2.4 : 0);
    $footerH = $footer !== '' ? 90 * $unit : 0;
    $y = $photo ? $H - $footerH - $pad - $blockH : max($pad, ($H - $footerH - $blockH) / 2);

    $x = fn (float $w) => (int) ($center ? ($W - $w) / 2 : $pad);
    $tc = color($im, $text);

    if ($badge !== '') {
        $bw = text_width($badge, $bSize, $bold) + 2 * (int) (26 * $unit);
        $bh = (int) ($bSize * 2.3);
        $bx = $x($bw);
        rounded_rect($im, $bx, (int) $y, $bx + $bw, (int) $y + $bh, $bh, color($im, $accent));
        imagettftext($im, $bSize, 0, $bx + (int) (26 * $unit), (int) ($y + $bh / 2 + $bSize * 0.36), color($im, $ctaText), $bold, $badge);
        $y += $bh + 34 * $unit;
    }
    foreach ($hLines as $line) {
        $y += $hLine;
        imagettftext($im, $hSize, 0, $x(text_width($line, $hSize, $bold)), (int) ($y - $hLine * 0.22), $tc, $bold, $line);
    }
    if ($sLines) {
        $y += 28 * $unit;
        $sc = color($im, $text, 20);
        foreach ($sLines as $line) {
            $y += $sLine;
            imagettftext($im, $sSize, 0, $x(text_width($line, $sSize, $regular)), (int) ($y - $sLine * 0.3), $sc, $regular, $line);
        }
    }
    if ($cta !== '') {
        $y += 48 * $unit;
        $cw = text_width($cta, $cSize, $bold) + 2 * (int) (44 * $unit);
        $ch = (int) ($cSize * 2.4);
        $cx = $x($cw);
        rounded_rect($im, $cx, (int) $y, $cx + $cw, (int) $y + $ch, (int) (14 * $unit), color($im, $accent));
        imagettftext($im, $cSize, 0, $cx + (int) (44 * $unit), (int) ($y + $ch / 2 + $cSize * 0.36), color($im, $ctaText), $bold, $cta);
    }
    if ($footer !== '') {
        $fSize = 28 * $unit;
        $fy = $H - $pad * 0.75;
        imagefilledrectangle($im, $center ? (int) ($W / 2 - 30 * $unit) : $pad, (int) ($fy - $fSize * 2.2), $center ? (int) ($W / 2 + 30 * $unit) : $pad + (int) (60 * $unit), (int) ($fy - $fSize * 2.2 + 5 * $unit), color($im, $accent));
        imagettftext($im, $fSize, 0, $x(text_width($footer, $fSize, $medium)), (int) $fy, color($im, $text, 25), $medium, $footer);
    }

    $dir = dirname(__DIR__, 2) . '/uploads';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $name = gmdate('Ymd') . '-ai-' . bin2hex(random_bytes(6)) . '.png';
    imagepng($im, "$dir/$name", 6);
    imagedestroy($im);
    return base_url() . '/uploads/' . $name;
}
