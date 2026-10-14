#!/usr/bin/env bash
# Builds hostinger/dist/social-media-connector-hostinger.zip:
#   static Social Media Connector site + PHP backend (api/) ready for public_html.
# Usage: bash hostinger/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
OUT="$ROOT/hostinger/dist"
trap 'rm -rf "$WORK"' EXIT

echo "→ Copying project"
git -C "$ROOT" ls-files -z --cached --others --exclude-standard | (cd "$ROOT" && tar --null -T - -cf -) | tar -xf - -C "$WORK"
cp -r "$ROOT/node_modules" "$WORK/node_modules"
# The portfolio needs a Node server (Supabase); only the Connector is exported.
rm -rf "$WORK/src/app/(portfolio)" "$WORK/src/app/favicon.ico"

echo "→ Building static site"
(cd "$WORK" && HOSTINGER_EXPORT=1 npx next build)

echo "→ Installing PHP backend"
(cd "$ROOT/hostinger/api" && composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --quiet)

SITE="$WORK/out"
rm -f "$SITE"/{file,globe,next,vercel,window}.svg
cp -r "$ROOT/hostinger/api" "$SITE/api"
rm -f "$SITE/api/composer.json" "$SITE/api/composer.lock"
# Ship only library code: drop VCS metadata, tests and docs from vendor/.
find "$SITE/api/vendor" -depth \( -name .git -o -name .github -o -name tests -o -name Tests -o -name examples -o -name fixtures -o -name docs \) -type d -exec rm -rf {} +
mkdir -p "$SITE/uploads"
cp "$ROOT/hostinger/public/.htaccess" "$SITE/.htaccess"
cp "$ROOT/hostinger/public/uploads.htaccess" "$SITE/uploads/.htaccess"
cp "$ROOT/hostinger/public/index.html" "$SITE/index.html"

mkdir -p "$OUT"
rm -f "$OUT/social-media-connector-hostinger.zip"
(cd "$SITE" && zip -qr "$OUT/social-media-connector-hostinger.zip" .)
cp "$ROOT/hostinger/smc-config.sample.php" "$OUT/smc-config.sample.php"
echo "✓ $OUT/social-media-connector-hostinger.zip"
