#!/bin/bash
# One-time setup on your MacBook:  bash setup.sh
set -e
cd "$(dirname "$0")"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Ye agent sirf macOS ke liye hai."; exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew nahi mila. Pehle ye command chalayein, phir setup.sh dobara chalayein:"
  echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi

echo "==> Tools install ho rahe hain (python, portaudio for mic, ffmpeg for video)…"
brew install python@3.12 portaudio ffmpeg

PY="$(brew --prefix python@3.12)/bin/python3.12"
echo "==> Python environment bana rahe hain…"
"$PY" -m venv .venv
./.venv/bin/pip install --upgrade pip >/dev/null
CFLAGS="-I$(brew --prefix portaudio)/include" LDFLAGS="-L$(brew --prefix portaudio)/lib" \
  ./.venv/bin/pip install -r requirements.txt

if [[ ! -d "/Applications/Google Chrome.app" && ! -d "$HOME/Applications/Google Chrome.app" ]]; then
  echo "⚠️  Google Chrome nahi mila. Posters banane aur Chrome kholne ke liye Chrome install karein:"
  echo "    brew install --cask google-chrome"
fi

echo
read -r -s -p "Apni Claude API key paste karein (ya Enter dabakar baad me Settings me daalein): " KEY
echo
if [[ -n "$KEY" ]]; then
  ./.venv/bin/python -m agent.config "$KEY"
fi

echo
echo "==> App bana rahe hain…"
bash make_app.sh

echo
echo "✅ Setup complete! Launchpad/Applications se agent kholiye, ya:  bash run.sh"
