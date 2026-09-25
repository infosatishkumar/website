#!/bin/bash
# Rebuilds the prebuilt launcher binaries. Works on macOS (cc) or anywhere with zig
# (pip install ziglang):  bash launcher/build.sh
set -e
cd "$(dirname "$0")"
if [[ "$(uname)" == "Darwin" ]] && command -v cc >/dev/null; then
  cc -O2 -arch x86_64 -mmacosx-version-min=11.0 -o launcher-x86_64 launcher.c
  cc -O2 -arch arm64 -mmacosx-version-min=11.0 -o launcher-arm64 launcher.c
else
  ZIG="${ZIG:-python3 -m ziglang}"
  $ZIG cc -O2 -target x86_64-macos.11.0 -o launcher-x86_64 launcher.c
  $ZIG cc -O2 -target aarch64-macos.11.0 -o launcher-arm64 launcher.c
fi
echo "built: $(ls launcher-*)"
