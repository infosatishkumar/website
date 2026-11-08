#!/bin/bash
# Karishma one-time setup for macOS (Intel or Apple Silicon). No Homebrew needed.
set -e
cd "$(dirname "$0")"

echo "==> Python 3.10+ dhundh rahi hoon"
PY=""
for cand in python3.13 python3.12 python3.11 python3.10 \
            /Library/Frameworks/Python.framework/Versions/3.1[0-3]/bin/python3 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    if "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      PY="$(command -v "$cand")"
      break
    fi
  fi
done

rm -rf .venv
if [ -n "$PY" ]; then
  echo "    Mil gaya: $PY ($("$PY" --version))"
  "$PY" -m venv .venv
else
  echo "    Naya Python nahi mila - 'uv' se Python 3.12 install kar rahi hoon (Homebrew ki zarurat nahi)..."
  if ! command -v uv >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/uv" ]; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
  "$UV" python install 3.12
  "$UV" venv --seed --python 3.12 .venv
fi

source .venv/bin/activate
echo "==> Packages install ho rahe hain"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "==> Browser (Chromium) for booking/ordering"
python -m playwright install chromium || echo "!! Chromium install fail hua. .env me KARISHMA_BROWSER_CHANNEL=chrome set karke Google Chrome use kar sakte hain."

echo "==> Microphone library check"
python -c "import sounddevice; print('    Mic library OK')" || echo "!! sounddevice load nahi hua - screenshot bhejiye."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> .env file bani hai - isme apni ANTHROPIC_API_KEY aur ELEVENLABS_API_KEY daaliye:"
  echo "    open -e $(pwd)/.env"
fi

chmod +x Karishma.command run.sh make_app.sh
./make_app.sh || echo "!! App banane me dikkat - ./make_app.sh dobara chalaiye."
echo ""
echo "✅ Setup complete!  Ab chalaiye:  ./run.sh   (ya Finder me Karishma.command double-click)"
echo "   Pehli baar Mac permissions maangega: Microphone, Accessibility, Automation, Screen Recording - sab Allow kariye."
