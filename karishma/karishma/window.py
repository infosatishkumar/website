"""Karishma as a normal Mac app window (Dock icon + status + chat).

Launched by Karishma.app (./make_app.sh). The voice loop runs on a background
thread and sends UI updates through a queue; Tk stays on the main thread.
"""

from __future__ import annotations

import logging
import os
import queue
import subprocess
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont

from .config import load_config
from .main import (
    FOLLOW_UP_WINDOW, RESET_WORDS, STOP_WORDS, VoiceIO, build, contains_wake_word, greeting,
)
from .voice import Mouth

log = logging.getLogger("karishma.window")

BG = "#1b1530"
PANEL = "#251d40"
TEXT = "#f3efff"
MUTED = "#a99fc9"
STATES = {
    # state: (orb colour, label)
    "starting": ("#7c3aed", "Shuru ho rahi hoon…"),
    "listening": ("#8b5cf6", "Sun rahi hoon — 'Karishma' boliye"),
    "awake": ("#22c55e", "Boliye, main sun rahi hoon…"),
    "thinking": ("#f59e0b", "Soch rahi hoon…"),
    "speaking": ("#ec4899", "Bol rahi hoon…"),
    "paused": ("#6b7280", "Paused — sun nahi rahi"),
    "error": ("#ef4444", "Problem hai"),
}


class UiMouth(Mouth):
    def __init__(self, cfg, post):
        super().__init__(cfg)
        self.post = post

    def speak(self, text: str) -> None:
        self.post("chat", "Karishma", text)
        self.post("state", "speaking", "")
        try:
            super().speak(text)
        finally:
            self.post("state", "_restore", "")


class UiVoiceIO(VoiceIO):
    def __init__(self, mouth, ears, post):
        super().__init__(mouth, ears)
        self.post = post

    def ask(self, question: str) -> str:
        self.say(question)
        self.post("state", "awake", "")
        for _ in range(2):
            ans = self.ears.listen(max_wait=20)
            if ans:
                self.post("chat", "Aap", ans)
                return ans
            self.say("Maine suna nahi, phir se boliye?")
        return ""


class KarishmaWindow:
    def __init__(self):
        self.cfg = load_config()
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(name)s %(levelname)s %(message)s",
            handlers=[logging.FileHandler(self.cfg.log_file, encoding="utf-8")],
        )
        self.events: queue.Queue = queue.Queue()
        self.typed: queue.Queue[str] = queue.Queue()
        self.paused = False
        self.stop = False
        self.brain = None
        self.base_state = "starting"

        self.root = tk.Tk()
        self.root.title("Karishma")
        self.root.geometry("440x620")
        self.root.minsize(360, 480)
        self.root.configure(bg=BG)
        icon = os.environ.get("KARISHMA_ICON")
        if icon and Path(icon).exists():
            try:
                self._icon = tk.PhotoImage(file=icon)
                self.root.iconphoto(True, self._icon)
            except tk.TclError:
                pass
        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.quit)
        self.root.after(150, self._pump)
        threading.Thread(target=self._worker, daemon=True).start()

    # ---------------- UI ----------------
    def _build_ui(self):
        big = tkfont.Font(family="Helvetica", size=22, weight="bold")
        mid = tkfont.Font(family="Helvetica", size=13)
        self.chat_font = tkfont.Font(family="Helvetica", size=13)

        top = tk.Frame(self.root, bg=BG)
        top.pack(fill="x", pady=(18, 6))
        self.orb = tk.Canvas(top, width=110, height=110, bg=BG, highlightthickness=0)
        self.orb.pack()
        self.orb_id = self.orb.create_oval(10, 10, 100, 100, fill=STATES["starting"][0], outline="")
        self.orb.create_text(55, 55, text="K", fill="white", font=big)
        tk.Label(top, text="Karishma", bg=BG, fg=TEXT, font=big).pack(pady=(6, 0))
        self.status = tk.Label(top, text=STATES["starting"][1], bg=BG, fg=MUTED, font=mid, wraplength=400)
        self.status.pack(pady=(2, 0))

        btns = tk.Frame(self.root, bg=BG)
        btns.pack(side="bottom", fill="x", padx=14, pady=(8, 14))
        self.pause_btn = tk.Button(btns, text="⏸ Pause", command=self.toggle_pause)
        self.pause_btn.pack(side="left")
        tk.Button(btns, text="Naya topic", command=self.new_topic).pack(side="left", padx=6)
        tk.Button(btns, text="Settings", command=self.open_settings).pack(side="left")
        tk.Button(btns, text="Band karo", command=self.quit).pack(side="right")

        entry_row = tk.Frame(self.root, bg=BG)
        entry_row.pack(side="bottom", fill="x", padx=14)
        self.entry = tk.Entry(entry_row, font=mid, relief="flat", bg="#ffffff", fg="#111111")
        self.entry.pack(side="left", fill="x", expand=True, ipady=6)
        self.entry.bind("<Return>", lambda e: self.send_typed())
        tk.Button(entry_row, text="Bhejo", command=self.send_typed).pack(side="left", padx=(6, 0))

        box = tk.Frame(self.root, bg=PANEL)
        box.pack(fill="both", expand=True, padx=14, pady=10)
        self.chat = tk.Text(box, bg=PANEL, fg=TEXT, wrap="word", relief="flat", font=self.chat_font,
                            padx=10, pady=10, state="disabled", highlightthickness=0, cursor="arrow")
        scroll = tk.Scrollbar(box, command=self.chat.yview)
        self.chat.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.chat.pack(side="left", fill="both", expand=True)
        self.chat.tag_configure("Karishma", foreground="#d8b4fe")
        self.chat.tag_configure("Aap", foreground="#93c5fd")
        self.chat.tag_configure("info", foreground=MUTED)


    def add_chat(self, who: str, text: str):
        self.chat.configure(state="normal")
        if who == "info":
            self.chat.insert("end", f"{text}\n\n", "info")
        else:
            self.chat.insert("end", f"{who}: ", who)
            self.chat.insert("end", f"{text}\n\n")
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def set_state(self, state: str, detail: str = ""):
        if state == "_restore":
            state = "paused" if self.paused else self.base_state
        colour, label = STATES.get(state, STATES["listening"])
        if state == "error" and detail:
            label = f"Problem: {detail}"
        elif detail:
            label = f"{label}  ({detail[:50]})"
        self.orb.itemconfigure(self.orb_id, fill=colour)
        self.status.configure(text=label)

    def _pump(self):
        try:
            while True:
                kind, a, b = self.events.get_nowait()
                if kind == "chat":
                    self.add_chat(a, b)
                elif kind == "state":
                    self.set_state(a, b)
        except queue.Empty:
            pass
        if not self.stop:
            self.root.after(150, self._pump)

    def post(self, kind, a, b=""):
        if kind == "state" and a in ("listening", "awake", "starting"):
            self.base_state = a
        self.events.put((kind, a, b))

    def send_typed(self):
        text = self.entry.get().strip()
        if text:
            self.entry.delete(0, "end")
            self.typed.put(text)

    def toggle_pause(self):
        self.paused = not self.paused
        self.pause_btn.configure(text="▶ Resume" if self.paused else "⏸ Pause")
        self.set_state("_restore")

    def new_topic(self):
        if self.brain:
            self.brain.reset()
        self.add_chat("info", "— Naya topic shuru —")

    def open_settings(self):
        env = Path(__file__).resolve().parent.parent / ".env"
        subprocess.run(["open", "-e", str(env)])
        self.add_chat("info", "Settings badalne ke baad Karishma ko band karke dobara kholiye.")

    def quit(self):
        self.stop = True
        try:
            self.root.destroy()
        finally:
            os._exit(0)

    def run(self):
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(800, lambda: self.root.attributes("-topmost", False))
        self.root.mainloop()

    # ---------------- voice loop (background thread) ----------------
    def _worker(self):
        try:
            self._run()
        except Exception as e:  # noqa: BLE001
            log.exception("Karishma crashed")
            self.post("state", "error", str(e)[:120])
            self.post("chat", "info", f"Error: {e}\n(Log: ~/.karishma/karishma.log)")

    def _handle(self, io, text: str):
        if RESET_WORDS.search(text):
            self.brain.reset()
            io.say("Theek hai, naya topic.")
            return
        self.post("state", "thinking")
        self.brain.on_status = lambda s: self.post("state", "thinking", s.replace("[tool] ", ""))
        io.say(self.brain.handle(text))

    def _run(self):
        cfg = self.cfg
        if not cfg.anthropic_api_key or not cfg.elevenlabs_api_key:
            self.post("state", "error", "API keys missing")
            self.post("chat", "info", "ANTHROPIC_API_KEY / ELEVENLABS_API_KEY nahi mili. 'Settings' dabakar daaliye.")
            return
        from .voice import Ears

        mouth = UiMouth(cfg, self.post)
        self.post("chat", "info", "Microphone check ho raha hai… 1 second shaant rahiye.")
        ears = Ears(cfg)
        io = UiVoiceIO(mouth, ears, self.post)
        if ears.mic_blocked:
            self.post("state", "error", "Microphone permission chahiye")
            mouth.speak("Mujhe microphone ki permission nahi mili, isliye main sun nahi pa rahi. "
                        "Settings me Karishma ya Python ko ON kar dijiye.")
            subprocess.run(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"])
            while ears.mic_blocked and not self.stop:
                time.sleep(5)
                ears.calibrate()
            mouth.speak("Shukriya! Ab main sun sakti hoon.")
        self.brain, browser = build(cfg, io)
        try:
            io.say(greeting(cfg))
            awake_until = time.time() + FOLLOW_UP_WINDOW
            while not self.stop:
                try:
                    typed = self.typed.get_nowait()
                except queue.Empty:
                    typed = None
                if typed:
                    self.post("chat", "Aap", typed)
                    self._handle(io, typed)
                    awake_until = time.time() + FOLLOW_UP_WINDOW
                    continue
                if self.paused:
                    time.sleep(0.3)
                    continue
                awake = cfg.listen_mode == "always" or time.time() < awake_until
                self.post("state", "awake" if awake else "listening")
                heard = ears.listen(max_wait=2)
                if not heard or self.paused:
                    continue
                request = heard
                if not awake:
                    after = contains_wake_word(heard, cfg)
                    if after is None:
                        continue
                    self.post("chat", "Aap", heard)
                    if not after:
                        io.say("Ji, boliye?")
                        self.post("state", "awake")
                        request = ears.listen(max_wait=15)
                        if not request:
                            continue
                        self.post("chat", "Aap", request)
                    else:
                        request = after
                else:
                    self.post("chat", "Aap", heard)
                if STOP_WORDS.search(request):
                    io.say("Theek hai. Jab zarurat ho 'Karishma' boliye.")
                    awake_until = 0
                    continue
                self._handle(io, request)
                awake_until = time.time() + FOLLOW_UP_WINDOW
        finally:
            browser.close()


def main() -> None:
    KarishmaWindow().run()


if __name__ == "__main__":
    main()
