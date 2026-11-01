#!/usr/bin/env bash
# Clean reinstall of OpenJarvis as "Karishma" with ElevenLabs "Monika Sogam" voice.
# Works on Intel and Apple Silicon Macs. Ollama and already-downloaded models are kept.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OJ="$HOME/.openjarvis"
VOICE_ID="2zRM7PkgwBPiau2jvVXc"   # ElevenLabs: Monika Sogam
ENV_FILE="$HOME/.karishma.env"
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

say() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- 1. clean up
say "1/6  Purana OpenJarvis hata rahe hain"
pkill -f "openjarvis" 2>/dev/null || true
rm -rf "$OJ" "$HOME/Desktop/OpenJarvis" "$HOME/Desktop/Karishma.command"
rm -f "$HOME/.local/bin/jarvis" "$HOME/.local/bin/jarvis-uninstall"
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.zprofile" "$HOME/.bash_profile"; do
  [[ -f "$rc" ]] && sed -i '' -e '/ELEVENLABS_API_KEY/d' -e '/karishma.env/d' "$rc" 2>/dev/null || true
done

# ---------------------------------------------------------------- 2. ollama
say "2/6  Ollama check"
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
(ollama list >/dev/null 2>&1) || (open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)); sleep 3

# ---------------------------------------------------------------- 3. openjarvis
say "3/6  OpenJarvis install (3-5 min)"
curl -fsSL https://open-jarvis.github.io/OpenJarvis/install.sh | bash || true
[[ -x "$OJ/.venv/bin/python" ]] || { echo "OpenJarvis install fail hua. Screenshot bhejein."; exit 1; }

# ---------------------------------------------------------------- 4. voice deps
say "4/6  Voice packages install (mic + speech-to-text)"
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
(cd "$OJ/src" && "$UV" pip install --python "$OJ/.venv/bin/python" -e ".[desktop]")
"$OJ/.venv/bin/python" -c "import sounddevice, faster_whisper; print('voice packages OK')"

# ---------------------------------------------------------------- 5. persona + config
say "5/6  Karishma persona + Monika Sogam voice set kar rahe hain"
cp "$HERE/karishma_system_prompt.md" "$OJ/karishma_system_prompt.md"
CFG="$OJ/config.toml"; touch "$CFG"
"$OJ/.venv/bin/python" - "$CFG" "$OJ" "$VOICE_ID" <<'PY'
import re, sys
path, oj, vid = sys.argv[1:]
text = open(path).read()
want = {
  "agent":  {"system_prompt_path": f'"{oj}/karishma_system_prompt.md"'},
  "speech": {"tts_backend": '"elevenlabs"', "voice_id": f'"{vid}"', "voice_speed": "1.0",
             "device": '"cpu"', "compute_type": '"int8"', "model": '"base"'},
  "digest": {"voice_id": f'"{vid}"'},
}
for sec, kvs in want.items():
    m = re.search(rf"^\[{sec}\]\s*$", text, re.M)
    if not m:
        text += f"\n[{sec}]\n" + "".join(f"{k} = {v}\n" for k, v in kvs.items()); continue
    s = m.end(); n = re.search(r"^\[", text[s:], re.M); e = s + n.start() if n else len(text)
    body = text[s:e]
    for k, v in kvs.items():
        p = re.compile(rf"^#?\s*{k}\s*=.*$", re.M)
        body = p.sub(f"{k} = {v}", body, count=1) if p.search(body) else body.rstrip("\n") + f"\n{k} = {v}\n"
    text = text[:s] + body + text[e:]
open(path, "w").write(text)
print("config OK")
PY

# ---------------------------------------------------------------- 6. elevenlabs key + test
say "6/6  ElevenLabs API key"
echo "Key yahan milegi: elevenlabs.io -> Profile -> API Keys"
while true; do
  read -rsp "ElevenLabs API key paste karein aur Enter dabayein: " KEY; echo
  KEY="$(echo "$KEY" | tr -d '[:space:]')"
  [[ -z "$KEY" ]] && continue
  code=$(curl -s -o /tmp/karishma_test.mp3 -w '%{http_code}' \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
    -H "xi-api-key: $KEY" -H "Content-Type: application/json" \
    -d '{"text":"Namaste! Main Karishma hoon, aapki personal AI assistant.","model_id":"eleven_multilingual_v2"}')
  if [[ "$code" == "200" ]]; then
    echo "Key sahi hai. Karishma ki awaaz chal rahi hai..."; afplay /tmp/karishma_test.mp3 || true; break
  fi
  echo "ElevenLabs ne error diya (HTTP $code): $(head -c 300 /tmp/karishma_test.mp3)"
  echo "Key dobara check karke paste karein."
done
umask 077; printf 'export ELEVENLABS_API_KEY="%s"\n' "$KEY" > "$ENV_FILE"
echo '[ -f "$HOME/.karishma.env" ] && source "$HOME/.karishma.env"' >> "$HOME/.zshrc"

# Desktop launcher: double-click to talk to Karishma
cat > "$HOME/Desktop/Karishma.command" <<'EOF'
#!/bin/zsh
source "$HOME/.karishma.env" 2>/dev/null
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
clear; echo "Karishma - Enter dabake boliye, chup hone par wo sunegi. Band karne ke liye /quit"
exec "$HOME/.openjarvis/.venv/bin/jarvis" chat --voice
EOF
chmod +x "$HOME/Desktop/Karishma.command"

say "Ho gaya! Desktop par 'Karishma' file par double-click karein."
echo "Pehli baar Mac microphone ki permission maangega - 'Allow' dabayein."
