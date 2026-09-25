#!/bin/bash
# Builds a normal Mac app (e.g. /Applications/Karishma.app) that opens the agent
# from Launchpad, Spotlight or the Dock like any other app.
#   bash make_app.sh               -> app named after the agent
#   bash make_app.sh "Jarvis"      -> custom app name
#   bash make_app.sh --login       -> also start automatically at login
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

LOGIN=0
NAME=""
for arg in "$@"; do
  if [[ "$arg" == "--login" ]]; then LOGIN=1; else NAME="$arg"; fi
done
if [[ -z "$NAME" ]]; then
  NAME="$(./.venv/bin/python -c 'from agent.config import Config; print(Config()["agent_name"])' 2>/dev/null || echo "AI Agent")"
fi

if [[ -w /Applications ]]; then DEST="/Applications"; else DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
APP="$DEST/$NAME.app"
echo "==> Building $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# --- icon ---
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s assets/icon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d assets/icon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

# --- launcher ---
cat > "$APP/Contents/MacOS/launcher" <<LAUNCH
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$PATH"
cd "$ROOT"
mkdir -p "\$HOME/Library/Logs"
exec "$ROOT/.venv/bin/python" -m agent.main >> "\$HOME/Library/Logs/AI-Agent.log" 2>&1
LAUNCH
chmod +x "$APP/Contents/MacOS/launcher"

BUNDLE_ID="com.aiagent.$(echo "$NAME" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]')"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$NAME</string>
  <key>CFBundleDisplayName</key><string>$NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>$NAME aapki awaaz sunkar kaam karti hai.</string>
  <key>NSSpeechRecognitionUsageDescription</key><string>$NAME aapki baat samajhne ke liye speech recognition use karti hai.</string>
  <key>NSAppleEventsUsageDescription</key><string>$NAME aapke kehne par apps (Chrome, Finder, Music…) control karti hai.</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
touch "$APP"

if [[ $LOGIN == 1 ]]; then
  osascript -e "tell application \"System Events\" to make login item at end with properties {path:\"$APP\", hidden:false}" >/dev/null
  echo "==> Login par auto-start ON"
fi

echo "✅ Ban gaya: $APP"
echo "   Launchpad / Spotlight (Cmd+Space) me \"$NAME\" likhkar kholiye."
