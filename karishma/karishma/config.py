"""Settings, loaded from environment / .env file."""

from __future__ import annotations

import os
import platform
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # dotenv is optional
    load_dotenv = None

HOME_DIR = Path(os.environ.get("KARISHMA_HOME", Path.home() / ".karishma"))


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "haan"}


@dataclass
class Config:
    anthropic_api_key: str | None = None
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str | None = None
    tts_model: str = "eleven_multilingual_v2"
    stt_model: str = "scribe_v1"
    model: str = "claude-opus-5-5"
    effort: str = "medium"
    user_name: str = ""
    user_city: str = ""
    listen_mode: str = "wake"  # wake | always | ptt
    wake_words: tuple[str, ...] = ("karishma", "karisma", "करिश्मा", "krishma", "charisma")
    browser_channel: str = "chromium"
    browser_executable: str | None = None
    browser_headless: bool = False
    home: Path = field(default_factory=lambda: HOME_DIR)
    is_mac: bool = field(default_factory=lambda: platform.system() == "Darwin")

    @property
    def memory_file(self) -> Path:
        return self.home / "memory.json"

    @property
    def browser_profile(self) -> Path:
        return self.home / "browser-profile"

    @property
    def log_file(self) -> Path:
        return self.home / "karishma.log"


def load_config(env_file: str | Path | None = None) -> Config:
    if load_dotenv is not None:
        if env_file:
            load_dotenv(env_file, override=False)
        else:
            # project .env first, then ~/.karishma/.env
            load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
            load_dotenv(HOME_DIR / ".env", override=False)

    env = os.environ.get
    cfg = Config(
        anthropic_api_key=env("ANTHROPIC_API_KEY") or None,
        elevenlabs_api_key=env("ELEVENLABS_API_KEY") or None,
        elevenlabs_voice_id=env("ELEVENLABS_VOICE_ID") or None,
        tts_model=env("ELEVENLABS_TTS_MODEL") or "eleven_multilingual_v2",
        stt_model=env("ELEVENLABS_STT_MODEL") or "scribe_v1",
        model=env("KARISHMA_MODEL") or "claude-opus-5-5",
        effort=env("KARISHMA_EFFORT") or "medium",
        user_name=env("KARISHMA_USER_NAME") or "",
        user_city=env("KARISHMA_USER_CITY") or "",
        listen_mode=(env("KARISHMA_LISTEN_MODE") or "wake").lower(),
        browser_channel=(env("KARISHMA_BROWSER_CHANNEL") or "chromium").lower(),
        browser_executable=env("KARISHMA_BROWSER_EXECUTABLE") or None,
        browser_headless=_bool(env("KARISHMA_BROWSER_HEADLESS"), False),
    )
    cfg.home.mkdir(parents=True, exist_ok=True)
    return cfg
