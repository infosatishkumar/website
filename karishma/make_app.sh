#!/bin/bash
# Creates Karishma.app (menu-bar app) in /Applications - no Terminal needed after this.
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
if [ ! -x "$DIR/.venv/bin/python" ]; then
  echo "Pehle ./setup_mac.sh chalaiye."; exit 1
fi
"$DIR/.venv/bin/python" -m pip install -q "rumps>=0.4.0"

DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
APP="$DEST/Karishma.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/MacOS/Karishma" <<SH
#!/bin/bash
mkdir -p "\$HOME/.karishma"
cd "$DIR"
exec "$DIR/.venv/bin/python" -m karishma.menubar >> "\$HOME/.karishma/app-output.log" 2>&1
SH
chmod +x "$APP/Contents/MacOS/Karishma"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Karishma</string>
  <key>CFBundleDisplayName</key><string>Karishma</string>
  <key>CFBundleIdentifier</key><string>local.karishma.assistant</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Karishma</string>
  <key>CFBundleIconFile</key><string>Karishma</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSMicrophoneUsageDescription</key><string>Karishma aapki awaaz sunne ke liye microphone use karti hai.</string>
  <key>NSAppleEventsUsageDescription</key><string>Karishma aapke kehne par Mac apps control karti hai.</string>
</dict>
</plist>
PLIST

# App icon (purple circle with K) - best effort
"$DIR/.venv/bin/python" - "$APP/Contents/Resources" <<'PY' || true
import os, subprocess, sys, tempfile
from AppKit import (NSImage, NSColor, NSBezierPath, NSFont, NSString, NSMakeRect,
                    NSFontAttributeName, NSForegroundColorAttributeName, NSBitmapImageRep, NSPNGFileType)
res = sys.argv[1]
iconset = tempfile.mkdtemp(suffix=".iconset")
def png(size, path):
    img = NSImage.alloc().initWithSize_((size, size))
    img.lockFocus()
    NSColor.colorWithCalibratedRed_green_blue_alpha_(0.49, 0.23, 0.93, 1).set()
    NSBezierPath.bezierPathWithOvalInRect_(NSMakeRect(size*0.04, size*0.04, size*0.92, size*0.92)).fill()
    s = NSString.stringWithString_("K")
    attrs = {NSFontAttributeName: NSFont.boldSystemFontOfSize_(size*0.55), NSForegroundColorAttributeName: NSColor.whiteColor()}
    w, h = s.sizeWithAttributes_(attrs)
    s.drawAtPoint_withAttributes_(((size-w)/2, (size-h)/2), attrs)
    img.unlockFocus()
    rep = NSBitmapImageRep.imageRepWithData_(img.TIFFRepresentation())
    rep.representationUsingType_properties_(NSPNGFileType, None).writeToFile_atomically_(path, True)
for s in (16, 32, 128, 256, 512):
    png(s, os.path.join(iconset, f"icon_{s}x{s}.png"))
    png(s*2, os.path.join(iconset, f"icon_{s}x{s}@2x.png"))
subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(res, "Karishma.icns")], check=True)
PY

codesign --force --deep -s - "$APP" 2>/dev/null || true
touch "$APP"
echo "✅ Karishma.app ban gayi: $APP"
echo "   Launchpad / Applications se kholiye. Menu bar (upar right) me 🟣 dikhega."
if [ "$1" = "--login" ]; then
  osascript -e "tell application \"System Events\" to make login item at end with properties {path:\"$APP\", hidden:true}" >/dev/null \
    && echo "   Mac on hote hi Karishma apne aap chalu hogi."
fi
