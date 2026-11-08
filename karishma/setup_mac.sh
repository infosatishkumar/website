#!/bin/bash
# Karishma one-time setup for macOS (Intel or Apple Silicon).
set -e
cd "$(dirname "$0")"

echo "==> Homebrew check"
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew install ho raha hai (password maangega)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/usr/local/bin/brew shellenv 2>/dev/null || /opt/homebrew/bin/brew shellenv)"
fi

echo "==> Python 3.12 + PortAudio (microphone ke liye)"
brew install python@3.12 portaudio

PY="$(brew --prefix python@3.12)/bin/python3.12"
echo "==> Virtual environment (.venv)"
"$PY" -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Browser (Chromium) for booking/ordering"
python -m playwright install chromium || echo "!! Chromium install fail hua. .env me KARISHMA_BROWSER_CHANNEL=chrome set karke Google Chrome use kar sakte hain."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> .env file bani hai - isme apni ANTHROPIC_API_KEY aur ELEVENLABS_API_KEY daaliye:"
  echo "    open -e $(pwd)/.env"
fi

chmod +x Karishma.command run.sh
echo ""
echo "✅ Setup complete!  Ab chalaiye:  ./run.sh   (ya Finder me Karishma.command double-click)"
echo "   Pehli baar Mac permissions maangega: Microphone, Accessibility, Automation, Screen Recording - sab Allow kariye."
