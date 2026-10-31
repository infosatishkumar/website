#!/usr/bin/env bash
# Installs OpenJarvis on macOS/Linux and sets it up as "Karishma" (female, Monika Sogam voice).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CFG="${OPENJARVIS_HOME:-$HOME/.openjarvis}"

# 1. Ollama CLI
if ! command -v ollama >/dev/null 2>&1; then
  echo ">> Installing Ollama"
  if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    brew install ollama || curl -fsSL https://ollama.com/install.sh | sh
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi

# 2. OpenJarvis (official installer: uv, venv, Ollama, starter model)
if ! command -v jarvis >/dev/null 2>&1; then
  echo ">> Installing OpenJarvis"
  curl -fsSL https://open-jarvis.github.io/OpenJarvis/install.sh | bash
fi

# 3. Desktop source checkout (for `jarvis gui`)
[[ -d "$HOME/Desktop/OpenJarvis" ]] || git clone https://github.com/open-jarvis/OpenJarvis.git "$HOME/Desktop/OpenJarvis"

# 4. Karishma persona + voice
mkdir -p "$CFG"
cp "$HERE/karishma_system_prompt.md" "$CFG/karishma_system_prompt.md"
[[ -f "$CFG/config.toml" ]] || (jarvis init >/dev/null 2>&1 || touch "$CFG/config.toml")
cp "$CFG/config.toml" "$CFG/config.toml.bak.$(date +%s)"
python3 - "$CFG/config.toml" "$HERE/config.overlay.toml" "$CFG" <<'PY'
import sys, re
cfg_path, overlay_path, cfg_dir = sys.argv[1:]
text = open(cfg_path).read()
overlay = open(overlay_path).read().replace("~/.openjarvis", cfg_dir)
sections, cur = {}, None
for line in overlay.splitlines():
    m = re.match(r"^\[(.+)\]\s*$", line)
    if m: cur = m.group(1); sections[cur] = []; continue
    if cur and "=" in line and not line.lstrip().startswith("#"):
        sections[cur].append(line.strip())
for sec, kvs in sections.items():
    hdr = re.search(rf"^\[{re.escape(sec)}\]\s*$", text, re.M)
    if not hdr:
        text += f"\n[{sec}]\n" + "\n".join(kvs) + "\n"; continue
    start = hdr.end()
    nxt = re.search(r"^\[", text[start:], re.M)
    end = start + nxt.start() if nxt else len(text)
    body = text[start:end]
    for kv in kvs:
        key = kv.split("=")[0].strip()
        pat = re.compile(rf"^#?\s*{re.escape(key)}\s*=.*$", re.M)
        body = pat.sub(kv, body, count=1) if pat.search(body) else body.rstrip("\n") + "\n" + kv + "\n"
    text = text[:start] + body + text[end:]
open(cfg_path, "w").write(text)
PY

# 5. ElevenLabs key (you type it; it stays on your Mac)
if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
  read -rsp "ElevenLabs API key (Enter to skip): " K; echo
  if [[ -n "$K" ]]; then
    RC="$HOME/.zshrc"; [[ -n "${BASH_VERSION:-}" && ! -f "$RC" ]] && RC="$HOME/.bashrc"
    echo "export ELEVENLABS_API_KEY=\"$K\"" >> "$RC"; export ELEVENLABS_API_KEY="$K"
  fi
fi

echo ">> Done. Open a new terminal, then run:  jarvis   (or: cd ~/Desktop/OpenJarvis && jarvis gui)"
echo ">> Health check:                           jarvis doctor"
