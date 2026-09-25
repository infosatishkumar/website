"""Settings that persist between runs (name, wake word, API key, voice...).

Stored in ~/Library/Application Support/AI-Agent/config.json so that renaming the
agent by voice ("apna naam Satish rakh lo") survives restarts.
"""

import copy
import json
import os
import threading
from pathlib import Path

APP_DIR = Path.home() / "Library" / "Application Support" / "AI-Agent"
CONFIG_PATH = APP_DIR / "config.json"
WORKSPACE = Path.home() / "Documents" / "AI-Agent"

DEFAULTS = {
    "agent_name": "Karishma",
    "wake_word": "Karishma",
    # Extra spellings the speech recogniser may produce for the wake word.
    "wake_aliases": ["karishma", "करिश्मा", "charisma", "krishma", "karisma"],
    "user_name": "Satish",
    "api_key": "",
    "model": "claude-opus-5",
    "effort": "medium",
    "voice": "",  # empty = auto-pick an Indian English voice
    "speech_rate": 185,
    "speak_replies": True,
    "stt_language": "en-IN",
    # Seconds the agent keeps listening for follow-ups after answering,
    # before it goes back to waiting for the wake word.
    "conversation_timeout": 25,
    "mic_enabled": True,
}

_lock = threading.Lock()


class Config:
    def __init__(self):
        self._data = copy.deepcopy(DEFAULTS)
        APP_DIR.mkdir(parents=True, exist_ok=True)
        WORKSPACE.mkdir(parents=True, exist_ok=True)
        if CONFIG_PATH.exists():
            try:
                self._data.update(json.loads(CONFIG_PATH.read_text()))
            except (OSError, json.JSONDecodeError):
                pass
        self.save()

    def __getitem__(self, key):
        with _lock:
            return copy.deepcopy(self._data.get(key, DEFAULTS.get(key)))

    def get(self, key, default=None):
        with _lock:
            return copy.deepcopy(self._data.get(key, default))

    def update(self, **changes):
        with _lock:
            for key, value in changes.items():
                if value is not None:
                    self._data[key] = value
        self.save()

    def save(self):
        with _lock:
            CONFIG_PATH.write_text(json.dumps(self._data, indent=2, ensure_ascii=False))
        try:
            os.chmod(CONFIG_PATH, 0o600)  # the file holds the API key
        except OSError:
            pass

    def public(self):
        """Settings safe to show in the UI (API key masked)."""
        with _lock:
            data = copy.deepcopy(self._data)
        key = data.get("api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
        data["api_key"] = ""
        data["has_api_key"] = bool(key)
        data["api_key_hint"] = f"…{key[-4:]}" if key else ""
        return data

    def api_key(self):
        return self["api_key"] or os.environ.get("ANTHROPIC_API_KEY", "")


if __name__ == "__main__":
    # `python -m agent.config sk-ant-...` saves the key from the command line.
    import sys

    cfg = Config()
    if len(sys.argv) > 1:
        cfg.update(api_key=sys.argv[1].strip())
        print("API key saved to", CONFIG_PATH)
    else:
        print(json.dumps(cfg.public(), indent=2, ensure_ascii=False))
