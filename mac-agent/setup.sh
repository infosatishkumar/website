#!/bin/bash
# One-time setup on your MacBook:  bash setup.sh
# Works on Intel and Apple Silicon Macs. Homebrew is NOT needed.
set -e
cd "$(dirname "$0")"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Ye agent sirf macOS ke liye hai."; exit 1
fi

# Clean up a broken Homebrew line in ~/.zprofile (from a failed Homebrew install on Intel Macs).
if [[ -f "$HOME/.zprofile" && ! -x /opt/homebrew/bin/brew ]] && grep -q "/opt/homebrew/bin/brew" "$HOME/.zprofile"; then
  sed -i '' '/\/opt\/homebrew\/bin\/brew/d' "$HOME/.zprofile"
  echo "==> ~/.zprofile se purani Homebrew line hata di."
fi

# uv: a small tool that downloads Python and installs packages (no admin rights needed).
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
  echo "==> uv install ho raha hai…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "==> Python 3.12 environment bana rahe hain…"
uv venv --python 3.12 --allow-existing .venv
echo "==> Packages install ho rahe hain (Claude, mic, video tools)…"
uv pip install --python .venv/bin/python -r requirements.txt

if [[ ! -d "/Applications/Google Chrome.app" && ! -d "$HOME/Applications/Google Chrome.app" ]]; then
  echo
  echo "⚠️  Google Chrome nahi mila. Posters banane aur Chrome kholne ke liye Chrome install karein:"
  echo "    https://www.google.com/chrome/"
fi

echo
echo "Claude API key paste karein (⌘+V) aur Enter dabayein."
echo "(Key screen par dikhegi nahi — ye normal hai. Abhi nahi daalni to sirf Enter dabayein.)"
read -r -s -p "API key: " KEY
echo
if [[ -n "$KEY" ]]; then
  ./.venv/bin/python -m agent.config "$KEY"
fi

echo
echo "==> App bana rahe hain…"
bash make_app.sh

echo
echo "✅ Setup complete! ⌘+Space dabakar agent ka naam likhiye aur kholiye, ya:  bash run.sh"
