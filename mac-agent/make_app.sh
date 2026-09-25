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
# A real (compiled) executable, so macOS shows the microphone permission prompt
# for this app. It starts the Python agent from this folder.
ARCH="$(uname -m)"
[[ "$ARCH" == "arm64" ]] || ARCH="x86_64"
cp "launcher/launcher-$ARCH" "$APP/Contents/MacOS/launcher"
chmod +x "$APP/Contents/MacOS/launcher"
echo "$ROOT" > "$APP/Contents/Resources/agent_root"

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
  <key>LSUIElement</key><true/>
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

# Reset old permission decisions so macOS asks again for the new build.
tccutil reset Microphone "$BUNDLE_ID" >/dev/null 2>&1 || true

echo "✅ Ban gaya: $APP"
echo "   Launchpad / Spotlight (Cmd+Space) me \"$NAME\" likhkar kholiye."
