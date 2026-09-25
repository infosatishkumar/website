"""Starts the agent: the animated window, the microphone loop and the Claude brain."""

import json
import os
import re
import sys
import threading
import time
import traceback
from pathlib import Path

# Apps opened from Finder get a minimal PATH; make tools in the usual folders visible.
os.environ["PATH"] = ":".join(["/opt/homebrew/bin", "/usr/local/bin", os.environ.get("PATH", "/usr/bin:/bin")])

import webview  # noqa: E402

from .brain import Brain  # noqa: E402
from .config import Config, WORKSPACE  # noqa: E402
from .tools import Toolbox  # noqa: E402
from .voice import Listener, Speaker, list_voices  # noqa: E402
from .wake import find_wake_word  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
UI_FILE = ROOT / "ui" / "index.html"
SETTINGS_FILE = ROOT / "ui" / "settings.html"
WIDGET_SIZE = (280, 330)  # floating widget: animation + caption
ICON_FILE = ROOT / "assets" / "icon.png"

STOP_WORDS = re.compile(r"^\s*(stop|ruko|ruk jao|chup|bas karo|cancel|shut up)\s*[.!]?\s*$", re.I)


class Agent:
    def __init__(self):
        self.config = Config()
        self.speaker = Speaker(self.config)
        self.listener = Listener(self.config)
        self.toolbox = Toolbox(self)
        self.brain = Brain(self)
        self.window = None
        self.ui_ready = False
        self._pending_js = []
        self.state = "sleeping"
        self.awake_until = 0.0
        self.sleep_after_reply = False
        self.busy = threading.Lock()

    # ---- UI bridge -----------------------------------------------------------

    def js(self, fn, *args):
        code = f"window.ui && ui.{fn}({', '.join(json.dumps(a, ensure_ascii=False) for a in args)})"
        if self.ui_ready and self.window:
            try:
                self.window.evaluate_js(code)
                return
            except Exception:
                pass
        self._pending_js.append(code)

    def on_loaded(self):
        self.ui_ready = True
        for code in self._pending_js:
            self.window.evaluate_js(code)
        self._pending_js.clear()
        self.push_settings()
        self.set_state(self.state)

    def set_state(self, state, detail=""):
        self.state = state
        self.js("setState", state, detail)

    def push_settings(self):
        self.js("setSettings", self.config.public())

    def announce(self, text):
        """Show + speak a message outside the normal reply flow (updates, timers)."""
        self.js("addMessage", "agent", text)
        self.speaker.speak(text, block=False)

    # ---- conversation --------------------------------------------------------

    def handle(self, text, source="voice"):
        text = text.strip()
        if not text:
            return
        if STOP_WORDS.match(text):
            self.speaker.stop()
            self.brain.cancelled = True
            self.set_state("listening")
            return
        if not self.busy.acquire(blocking=False):
            self.js("addMessage", "system", "Abhi pichla kaam chal raha hai… (Stop dabake rok sakte hain)")
            return
        try:
            self.js("addMessage", "user", text)
            self.set_state("thinking", "Soch rahi hoon…")

            def on_event(kind, detail):
                if kind == "tool":
                    self.set_state("working", detail)
                    self.js("addMessage", "tool", detail)
                elif kind == "progress":
                    self.js("addMessage", "agent", detail)
                    self.speaker.speak(detail, block=False)

            reply = self.brain.ask(text, on_event)
            self.js("addMessage", "agent", reply)
            self.set_state("speaking")
            self.speaker.speak(reply, block=True)
        finally:
            self.busy.release()
            if self.sleep_after_reply:
                self.sleep_after_reply = False
                self.go_to_sleep()
            else:
                self.awake_until = time.time() + self.config["conversation_timeout"]
                self.set_state("listening" if self.config["mic_enabled"] else "idle")

    def go_to_sleep(self):
        self.awake_until = 0
        self.set_state("sleeping", f"“{self.config['wake_word']}” boliye")

    def wake(self, greet=True):
        self.awake_until = time.time() + self.config["conversation_timeout"]
        self.set_state("listening")
        if greet:
            self.speaker.speak(f"Haan {self.config['user_name']}, boliye?", block=True)

    def voice_loop(self):
        name = self.config["agent_name"]
        self.announce(f"Namaste {self.config['user_name']}! Main {name} hoon. "
                      f"Mujhe kaam ke liye “{self.config['wake_word']}” boliye.")
        self.speaker.wait()
        self.go_to_sleep()
        shown_problem = None
        while True:
            try:
                self._listen_once()
                problem = self.listener.problem
                if problem != shown_problem:
                    shown_problem = problem
                    if problem:
                        self.set_state("error", problem)
                    elif self.state == "error":
                        self.go_to_sleep()
            except Exception:
                # Never let one bad moment kill the microphone loop.
                traceback.print_exc()
                time.sleep(1)

    def _listen_once(self):
        if not self.config["mic_enabled"]:
            time.sleep(0.5)
            return
        if self.speaker.speaking or self.busy.locked():
            time.sleep(0.2)  # don't listen to our own voice
            return
        awake = time.time() < self.awake_until
        if not awake and self.state in ("listening", "idle"):
            self.go_to_sleep()
        text = self.listener.listen(timeout=6, phrase_limit=20)
        if text is None:
            time.sleep(3)
            return
        if not text:
            return
        command = find_wake_word(text, self.config["wake_word"], self.config["wake_aliases"])
        if awake:
            # Follow-up without the wake word; strip it if said anyway.
            if command == "":
                self.wake(greet=True)
            else:
                self.handle(text if command is None else command)
        elif command is None:
            # Heard something, but not the wake word: show it briefly so it's
            # clear the mic works and what name to say.
            self.js("heard", text, self.config["wake_word"])
        elif command:
            self.wake(greet=False)
            self.handle(command)
        else:
            self.wake(greet=True)


class Api:
    """Functions the web UI can call as window.pywebview.api.<name>()."""

    def __init__(self, agent):
        self._agent = agent
        self._settings_window = None

    def send_text(self, text):
        threading.Thread(target=self._agent.handle, args=(text, "typed"), daemon=True).start()

    def wake(self):
        threading.Thread(target=self._agent.wake, daemon=True).start()

    def stop(self):
        self._agent.speaker.stop()
        self._agent.brain.cancelled = True

    def toggle_mic(self):
        enabled = not self._agent.config["mic_enabled"]
        self._agent.config.update(mic_enabled=enabled)
        if enabled:
            self._agent.go_to_sleep()
        else:
            self._agent.set_state("idle", "Mic band hai")
        self._agent.push_settings()
        return enabled

    def get_settings(self):
        data = self._agent.config.public()
        data["voices"] = [f"{n}|{loc}" for n, loc in list_voices()]
        data["current_voice"] = self._agent.speaker.voice
        data["workspace"] = str(WORKSPACE)
        return data

    def save_settings(self, data):
        allowed = {"agent_name", "wake_word", "user_name", "voice", "speech_rate", "stt_language",
                   "model", "effort", "speak_replies", "conversation_timeout", "api_key"}
        changes = {k: v for k, v in (data or {}).items()
                   if k in allowed and (v not in (None, "") or k == "voice")}
        if "speech_rate" in changes:
            changes["speech_rate"] = int(changes["speech_rate"])
        if "conversation_timeout" in changes:
            changes["conversation_timeout"] = int(changes["conversation_timeout"])
        if "wake_word" in changes:
            aliases = set(self._agent.config["wake_aliases"]) if changes["wake_word"] == self._agent.config["wake_word"] else set()
            aliases.add(changes["wake_word"].lower())
            changes["wake_aliases"] = sorted(aliases)
        self._agent.config.update(**changes)
        self._agent.speaker.refresh_voice()
        self._agent.push_settings()
        return self.get_settings()

    def test_voice(self):
        self._agent.speaker.speak(f"Namaste, main {self._agent.config['agent_name']} hoon.", block=False, interrupt=True)

    def open_workspace(self):
        os.system(f'open "{WORKSPACE}"')

    def clear_chat(self):
        self._agent.brain.reset()

    def open_settings(self):
        if self._settings_window is not None:
            try:
                self._settings_window.restore()
                self._settings_window.show()
                return
            except Exception:
                self._settings_window = None
        win = webview.create_window(
            "Settings", url=str(SETTINGS_FILE), js_api=self, width=460, height=640,
            resizable=False, on_top=True, background_color="#14122B",
        )

        def closed():
            self._settings_window = None

        win.events.closed += closed
        self._settings_window = win

    def close_settings(self):
        if self._settings_window is not None:
            self._settings_window.destroy()
            self._settings_window = None

    def minimize(self):
        self._agent.window.minimize()

    def quit(self):
        self._agent.speaker.stop()
        self._agent.window.destroy()


def _set_dock_icon():
    """Show our orb icon in the Dock instead of Python's rocket."""
    if sys.platform != "darwin" or not ICON_FILE.exists():
        return
    try:
        from AppKit import NSApplication, NSImage
        from PyObjCTools import AppHelper

        def apply():
            image = NSImage.alloc().initWithContentsOfFile_(str(ICON_FILE))
            NSApplication.sharedApplication().setApplicationIconImage_(image)

        AppHelper.callAfter(apply)
    except Exception:
        pass


def main():
    agent = Agent()
    api = Api(agent)
    width, height = WIDGET_SIZE
    x = y = None
    try:
        # Park the widget in the bottom-right corner of the main screen.
        screen = webview.screens[0]
        x, y = screen.width - width - 24, screen.height - height - 40
    except Exception:
        pass
    agent.window = webview.create_window(
        agent.config["agent_name"],
        url=str(UI_FILE),
        js_api=api,
        width=width,
        height=height,
        x=x,
        y=y,
        resizable=False,
        frameless=True,
        easy_drag=False,
        shadow=False,
        on_top=True,
        transparent=True,
        background_color="#000000",
    )
    agent.window.events.loaded += agent.on_loaded

    def started():
        _set_dock_icon()
        threading.Thread(target=agent.voice_loop, daemon=True).start()

    webview.start(started, debug="--debug" in sys.argv)


if __name__ == "__main__":
    main()
