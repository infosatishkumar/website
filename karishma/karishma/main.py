"""Karishma - voice AI assistant for macOS.

    python -m karishma            # voice mode (says "Karishma ..." to wake her)
    python -m karishma --text     # keyboard chat mode (no microphone needed)
    python -m karishma --check    # check keys, mic, permissions
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import time

from .brain import Brain
from .config import Config, load_config
from .tools import (
    Memory, ToolRegistry, register_browser_tools, register_memory_tools, register_system_tools,
)
from .voice import Mouth, is_yes

STOP_WORDS = re.compile(r"\b(bye|goodbye|band ho ja|so jao|chup|stop listening|exit|quit)\b|बाय|अलविदा", re.I)
RESET_WORDS = re.compile(r"\b(new chat|naya topic|nayi baat|reset|bhool ja)\b", re.I)
FOLLOW_UP_WINDOW = 45  # seconds she keeps listening after answering, without the wake word


class TextIO:
    """Keyboard/console interaction."""

    def __init__(self, mouth: Mouth | None = None):
        self.mouth = mouth

    def say(self, text: str) -> None:
        if self.mouth:
            self.mouth.speak(text)
        else:
            print(f"\n🟣 Karishma: {text}\n", flush=True)

    def ask(self, question: str) -> str:
        self.say(question)
        try:
            return input("🧑 Aap: ").strip()
        except EOFError:
            return ""

    def confirm(self, summary: str) -> bool:
        self.say(summary + " (haan / nahi)")
        try:
            return is_yes(input("🧑 Aap (haan/nahi): "))
        except EOFError:
            return False


class VoiceIO:
    """Microphone + speaker interaction. Confirmations also accept keyboard 'y' as backup."""

    def __init__(self, mouth: Mouth, ears):
        self.mouth = mouth
        self.ears = ears

    def say(self, text: str) -> None:
        self.mouth.speak(text)

    def ask(self, question: str) -> str:
        self.say(question)
        for _ in range(2):
            ans = self.ears.listen(max_wait=20)
            if ans:
                print(f"🧑 Aap: {ans}")
                return ans
            self.say("Maine suna nahi, phir se boliye?")
        return ""

    def confirm(self, summary: str) -> bool:
        ans = self.ask(summary + " Haan ya nahi?")
        ok = is_yes(ans)
        print(f"   -> {'APPROVED' if ok else 'DECLINED'}")
        return ok


def build(cfg: Config, io, client=None) -> tuple[Brain, object]:
    memory = Memory(cfg.memory_file)
    reg = ToolRegistry()
    register_system_tools(reg, cfg, io)
    browser = register_browser_tools(reg, cfg, io)
    register_memory_tools(reg, memory)
    brain = Brain(cfg, reg, memory.as_text, client=client, on_status=lambda s: print(f"   … {s}", flush=True))
    return brain, browser


def greeting(cfg: Config) -> str:
    h = time.localtime().tm_hour
    part = "Good morning" if h < 12 else "Good afternoon" if h < 17 else "Good evening"
    name = f" {cfg.user_name}" if cfg.user_name else ""
    return f"{part}{name}! Main Karishma hoon. Bataiye, aaj kya karna hai?"


def contains_wake_word(text: str, cfg: Config) -> str | None:
    """Return the request after the wake word, '' if only the wake word, None if absent."""
    low = text.lower()
    for w in cfg.wake_words:
        i = low.find(w)
        if i != -1:
            return text[i + len(w):].strip(" ,.!?।")
    return None


def run_text(cfg: Config, speak: bool) -> None:
    mouth = Mouth(cfg) if speak else None
    io = TextIO(mouth)
    brain, browser = build(cfg, io)
    io.say(greeting(cfg))
    try:
        while True:
            try:
                text = input("🧑 Aap: ").strip()
            except EOFError:
                break
            if not text:
                continue
            if STOP_WORDS.search(text):
                io.say("Theek hai, bye! Jab zarurat ho bula lijiye.")
                break
            if RESET_WORDS.search(text):
                brain.reset()
                io.say("Theek hai, naya topic shuru karte hain.")
                continue
            io.say(brain.handle(text))
    except KeyboardInterrupt:
        pass
    finally:
        browser.close()


def run_voice(cfg: Config) -> None:
    from .voice import Ears

    mouth = Mouth(cfg)
    print("🎤 Mic calibrate ho raha hai... 1 second shaant rahiye.")
    ears = Ears(cfg)
    io = VoiceIO(mouth, ears)
    brain, browser = build(cfg, io)
    io.say(greeting(cfg))
    awake_until = time.time() + FOLLOW_UP_WINDOW
    mode = cfg.listen_mode
    if mode == "wake":
        print("👂 'Karishma' bol ke kuch bhi puchiye. (Ctrl+C se band)")
    try:
        while True:
            if mode == "ptt":
                input("⏎ Enter dabaiye aur boliye...")
            heard = ears.listen(max_wait=60)
            if not heard:
                continue
            print(f"🧑 Aap: {heard}")
            request = heard
            if mode == "wake" and time.time() > awake_until:
                after = contains_wake_word(heard, cfg)
                if after is None:
                    continue  # not talking to Karishma
                if not after:
                    io.say("Ji, boliye?")
                    request = ears.listen(max_wait=15)
                    if not request:
                        continue
                    print(f"🧑 Aap: {request}")
                else:
                    request = after
            if STOP_WORDS.search(request):
                io.say("Theek hai, main sun rahi hoon jab bhi 'Karishma' bolenge.")
                awake_until = 0
                continue
            if RESET_WORDS.search(request):
                brain.reset()
                io.say("Theek hai, naya topic.")
                continue
            io.say(brain.handle(request))
            awake_until = time.time() + FOLLOW_UP_WINDOW
    except KeyboardInterrupt:
        print("\nBye!")
    finally:
        browser.close()


def check(cfg: Config) -> int:
    ok = True
    def line(good: bool, msg: str):
        nonlocal ok
        ok &= good
        print(("✅ " if good else "❌ ") + msg)
    line(bool(cfg.anthropic_api_key), "ANTHROPIC_API_KEY set")
    line(bool(cfg.elevenlabs_api_key), "ELEVENLABS_API_KEY set (needed for voice)")
    line(cfg.is_mac, "Running on macOS")
    try:
        import sounddevice as sd
        sd.query_devices(kind="input")
        line(True, "Microphone found")
    except Exception as e:  # noqa: BLE001
        line(False, f"Microphone: {e}")
    try:
        import anthropic
        anthropic.Anthropic(api_key=cfg.anthropic_api_key).models.retrieve(cfg.model)
        line(True, f"Claude model {cfg.model} reachable")
    except Exception as e:  # noqa: BLE001
        line(False, f"Claude API: {e}")
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="karishma", description="Karishma voice AI assistant")
    ap.add_argument("--text", action="store_true", help="keyboard chat mode")
    ap.add_argument("--speak", action="store_true", help="in --text mode, also speak replies")
    ap.add_argument("--check", action="store_true", help="check setup")
    ap.add_argument("--mode", choices=["wake", "always", "ptt"], help="listening mode")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args(argv)

    cfg = load_config()
    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(cfg.log_file, encoding="utf-8")],
    )
    if args.mode:
        cfg.listen_mode = args.mode
    if args.check:
        return check(cfg)
    if not cfg.anthropic_api_key:
        print("❌ ANTHROPIC_API_KEY missing. karishma/.env file me daaliye (see .env.example).")
        return 1
    if args.text:
        run_text(cfg, speak=args.speak)
    else:
        run_voice(cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
