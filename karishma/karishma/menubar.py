"""Karishma as a macOS menu-bar app (no Terminal needed).

Launched by Karishma.app (created with ./make_app.sh). The voice loop runs on a
background thread; the menu bar shows what Karishma is doing.
"""

from __future__ import annotations

import logging
import queue
import subprocess
import threading
import time

import rumps

from .config import load_config
from .main import (
    FOLLOW_UP_WINDOW, RESET_WORDS, STOP_WORDS, VoiceIO, build, contains_wake_word, greeting,
)
from .voice import Mouth

log = logging.getLogger("karishma.app")

ICONS = {
    "starting": "🟣…",
    "listening": "🟣",
    "hearing": "👂",
    "thinking": "💭",
    "speaking": "🔊",
    "paused": "⏸",
    "error": "⚠️",
}
LABELS = {
    "starting": "Shuru ho rahi hoon…",
    "listening": "Sun rahi hoon – 'Karishma' boliye",
    "hearing": "Aapki baat sun rahi hoon…",
    "thinking": "Soch rahi hoon…",
    "speaking": "Bol rahi hoon…",
    "paused": "Paused (sun nahi rahi)",
    "error": "Problem – log dekhiye",
}


class StatusMouth(Mouth):
    """Mouth that reports 'speaking' to the menu bar."""

    def __init__(self, cfg, app: "KarishmaApp"):
        super().__init__(cfg)
        self.app = app

    def speak(self, text: str) -> None:
        prev = self.app.state
        self.app.set_state("speaking")
        self.app.last_reply = text
        try:
            super().speak(text)
        finally:
            self.app.set_state(prev if prev != "speaking" else "listening")


class KarishmaApp(rumps.App):
    def __init__(self):
        super().__init__("Karishma", title=ICONS["starting"], quit_button=None)
        self.cfg = load_config()
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(name)s %(levelname)s %(message)s",
            handlers=[logging.FileHandler(self.cfg.log_file, encoding="utf-8")],
        )
        self.state = "starting"
        self.detail = ""
        self.last_reply = ""
        self.paused = False
        self.stop = False
        self.typed: queue.Queue[str] = queue.Queue()
        self.brain = None

        self.status_item = rumps.MenuItem(LABELS["starting"])
        self.pause_item = rumps.MenuItem("Sunna band karo (Pause)", callback=self.toggle_pause)
        self.menu = [
            self.status_item,
            None,
            rumps.MenuItem("Type karke poochho…", callback=self.ask_typed),
            rumps.MenuItem("Aakhri jawab dikhao", callback=self.show_last),
            self.pause_item,
            rumps.MenuItem("Naya topic", callback=self.new_topic),
            None,
            rumps.MenuItem("Settings (.env) kholo", callback=self.open_settings),
            rumps.MenuItem("Log kholo", callback=self.open_log),
            None,
            rumps.MenuItem("Karishma band karo", callback=self.quit_app),
        ]
        rumps.Timer(self.refresh, 0.4).start()
        threading.Thread(target=self.worker, daemon=True).start()

    # ---------------- UI (main thread) ----------------
    def set_state(self, state: str, detail: str = "") -> None:
        self.state = state
        self.detail = detail

    def refresh(self, _):
        self.title = ICONS.get(self.state, "🟣")
        label = LABELS.get(self.state, self.state)
        if self.detail:
            label = f"{label}  {self.detail[:60]}"
        if self.status_item.title != label:
            self.status_item.title = label

    def toggle_pause(self, sender):
        self.paused = not self.paused
        sender.title = "Sunna shuru karo (Resume)" if self.paused else "Sunna band karo (Pause)"
        self.set_state("paused" if self.paused else "listening")

    def ask_typed(self, _):
        w = rumps.Window(
            title="Karishma se poochhiye",
            message="Jo bhi kaam ho, yahan likhiye:",
            default_text="",
            ok="Bhejo",
            cancel="Cancel",
            dimensions=(380, 80),
        )
        r = w.run()
        if r.clicked and r.text.strip():
            self.typed.put(r.text.strip())

    def show_last(self, _):
        rumps.alert(title="Karishma", message=self.last_reply or "Abhi tak koi jawab nahi.")

    def new_topic(self, _):
        if self.brain:
            self.brain.reset()
        rumps.alert(title="Karishma", message="Naya topic shuru – purani baat bhool gayi.")

    def open_settings(self, _):
        from pathlib import Path

        env = Path(__file__).resolve().parent.parent / ".env"
        subprocess.run(["open", "-e", str(env)])
        rumps.alert(title="Karishma", message="Settings badalne ke baad Karishma ko band karke dobara kholiye.")

    def open_log(self, _):
        subprocess.run(["open", "-a", "Console", str(self.cfg.log_file)])

    def quit_app(self, _):
        self.stop = True
        rumps.quit_application()

    # ---------------- voice loop (background thread) ----------------
    def worker(self):
        try:
            self._run()
        except Exception as e:  # noqa: BLE001
            log.exception("Karishma crashed")
            self.set_state("error", str(e))

    def _handle(self, io, text: str) -> None:
        if RESET_WORDS.search(text):
            self.brain.reset()
            io.say("Theek hai, naya topic.")
            return
        self.set_state("thinking")
        self.brain.on_status = lambda s: self.set_state("thinking", s)
        reply = self.brain.handle(text)
        io.say(reply)

    def _run(self):
        cfg = self.cfg
        if not cfg.anthropic_api_key or not cfg.elevenlabs_api_key:
            self.set_state("error", "API keys missing – Settings kholiye")
            return
        from .voice import Ears

        mouth = StatusMouth(cfg, self)
        ears = Ears(cfg)
        io = VoiceIO(mouth, ears)
        self.brain, browser = build(cfg, io)
        try:
            io.say(greeting(cfg))
            awake_until = time.time() + FOLLOW_UP_WINDOW
            self.set_state("listening")
            while not self.stop:
                try:
                    typed = self.typed.get_nowait()
                except queue.Empty:
                    typed = None
                if typed:
                    self._handle(io, typed)
                    awake_until = time.time() + FOLLOW_UP_WINDOW
                    self.set_state("paused" if self.paused else "listening")
                    continue
                if self.paused:
                    time.sleep(0.3)
                    continue
                self.set_state("listening")
                heard = ears.listen(max_wait=2)
                if not heard or self.paused:
                    continue
                log.info("heard: %s", heard)
                request = heard
                if cfg.listen_mode != "always" and time.time() > awake_until:
                    after = contains_wake_word(heard, cfg)
                    if after is None:
                        continue
                    if not after:
                        io.say("Ji, boliye?")
                        self.set_state("hearing")
                        request = ears.listen(max_wait=15)
                        if not request:
                            continue
                    else:
                        request = after
                if STOP_WORDS.search(request):
                    io.say("Theek hai. Jab zarurat ho 'Karishma' boliye.")
                    awake_until = 0
                    continue
                self._handle(io, request)
                awake_until = time.time() + FOLLOW_UP_WINDOW
        finally:
            browser.close()


def main() -> None:
    try:  # no Dock icon - live only in the menu bar
        from AppKit import NSApplication, NSApplicationActivationPolicyAccessory

        NSApplication.sharedApplication().setActivationPolicy_(NSApplicationActivationPolicyAccessory)
    except Exception:  # noqa: BLE001
        pass
    KarishmaApp().run()


if __name__ == "__main__":
    main()
