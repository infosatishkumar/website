"""Karishma - Siri-style floating orb for macOS.

A small animated orb floats at the top-right of the screen. What you said and
Karishma's answer appear in cards below it.

Threads
- UI (main):  Tk drawing + animation
- listener:   the ONLY thread that reads the microphone. Keeps listening even while
              Karishma talks or works -> if you speak she stops talking at once
              (barge-in) and your new command replaces the old one.
- brain:      runs Claude + tools one job at a time (Playwright needs one thread).
"""

from __future__ import annotations

import logging
import math
import os
import queue
import random
import re
import subprocess
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont

from .config import load_config
from .main import FOLLOW_UP_WINDOW, RESET_WORDS, build, greeting
from . import fastpath
from .listening import route
from .voice import Mouth, is_yes, output_is_speakers

log = logging.getLogger("karishma.window")


W = 380                # window width
ORB_R = 30             # orb base radius
ORB_CX, ORB_CY = W - 52, 52
CARD = "#1f2233"
CARD2 = "#2a2e45"
TXT = "#f4f4fb"
SUB = "#a5a8c3"
SIRI = ["#7c3aed", "#ec4899", "#22d3ee", "#3b82f6", "#a855f7"]


# ---------------------------------------------------------------- IO for the brain
class OrbIO:
    """say/ask/confirm used by tools. Answers come from the listener thread."""

    def __init__(self, app: "OrbApp"):
        self.app = app

    def say(self, text: str, show: bool = True) -> None:
        if show:
            self.app.show_answer(text)
        self.app.set_state("speaking")
        try:
            self.app.mouth.speak(text)
        finally:
            self.app.last_activity = time.time()
            self.app.set_state("awake")

    def ask(self, question: str, detail: str = "") -> str:
        # Start accepting the answer BEFORE speaking, so "haan" said while she's
        # still talking counts (and stops her).
        self.app.begin_answer()
        self.app.show_answer(question + (f"\n\n{detail}" if detail else ""))
        self.say(question, show=False)
        return self.app.wait_for_answer(timeout=30)

    def confirm(self, summary: str, detail: str = "") -> bool:
        return is_yes(self.ask(summary.strip() + " Haan ya nahi?", detail=detail))

    def show_cards(self, items: list[dict]) -> None:
        self.app.show_results(items)


# ---------------------------------------------------------------- the app
class OrbApp:
    def __init__(self):
        self.cfg = load_config()
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(name)s %(levelname)s %(message)s",
            handlers=[logging.FileHandler(self.cfg.log_file, encoding="utf-8")],
        )
        self.state = "starting"
        self.paused = False
        self.stop_all = False
        self.awake_until = 0.0
        self.jobs: queue.Queue[str] = queue.Queue()
        self.answers: queue.Queue[str] = queue.Queue()
        self.waiting_answer = threading.Event()
        self.busy = threading.Event()        # brain is working on a job
        self.ui: queue.Queue = queue.Queue()  # (kind, payload) for the Tk thread
        self.brain = None
        self.mouth = None
        self.ears = None
        self.io = OrbIO(self)

        # view state
        self.query_text = ""
        self.answer_text = ""
        self.status_text = "Shuru ho rahi hoon…"
        self.cards_visible = True
        self.results: list[dict] = []
        self._hit: list[tuple] = []          # clickable result rectangles
        self.hidden = False
        self.typing = None                   # typing Toplevel
        self.last_activity = time.time()
        self.t0 = time.time()
        self.smooth_level = 0.0

        self._build_window()
        threading.Thread(target=self._startup, daemon=True).start()

    # ======================= UI (main thread) =======================
    def _build_window(self):
        self.root = tk.Tk()
        self.root.title("Karishma")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        bg = "#000001"
        try:  # real transparency on macOS
            self.root.attributes("-transparent", True)
            self.root.configure(bg="systemTransparent")
            bg = "systemTransparent"
        except tk.TclError:
            self.root.configure(bg="#14151f")
            bg = "#14151f"
        icon = os.environ.get("KARISHMA_ICON")
        if icon and Path(icon).exists():
            try:
                self._icon = tk.PhotoImage(file=icon)
                self.root.iconphoto(True, self._icon)
            except tk.TclError:
                pass
        self.frames: list = []   # each frame = list of (polygon points, area) - one per star
        self.star_size = int(ORB_R * 2.7)
        try:
            from .lottie_frames import vector_frames

            self.frames = vector_frames(self.cfg.home, size=self.star_size)
            log.info("sparkle animation: %d frames", len(self.frames))
        except Exception:  # noqa: BLE001  (falls back to the drawn orb)
            log.exception("could not load sparkle animation")
        self.canvas = tk.Canvas(self.root, width=W, height=120, bg=bg, highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True)
        self.f_query = tkfont.Font(family="Helvetica", size=14, weight="bold")
        self.f_answer = tkfont.Font(family="Helvetica", size=14)
        self.f_small = tkfont.Font(family="Helvetica", size=11)

        sw = self.root.winfo_screenwidth()
        self.win_x, self.win_y = sw - W - 10, 34
        self.root.geometry(f"{W}x120+{self.win_x}+{self.win_y}")

        self.canvas.bind("<ButtonPress-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.canvas.bind("<ButtonRelease-1>", self._release)
        self.canvas.bind("<Button-2>", self._menu)          # right click (mac)
        self.canvas.bind("<Button-3>", self._menu)
        self.canvas.bind("<Control-Button-1>", self._menu)

        self.menu = tk.Menu(self.root, tearoff=0)
        self.menu.add_command(label="⌨️  Type karke poochho…", command=self.ask_typed)
        self.menu.add_command(label="⏸  Pause / Resume", command=self.toggle_pause)
        self.menu.add_command(label="🆕  Naya topic", command=self.new_topic)
        self.menu.add_command(label="🗂  Jawab dikhao / chhupao", command=self.toggle_cards)
        self.menu.add_separator()
        self.menu.add_command(label="⚙️  Settings (.env)", command=self.open_settings)
        self.menu.add_command(label="📄  Log", command=lambda: subprocess.run(["open", "-a", "Console", str(self.cfg.log_file)]))
        self.menu.add_separator()
        self.menu.add_command(label="❌  Karishma band karo", command=self.quit)

        try:  # clicking Karishma in the Dock brings her back with the typing box
            self.root.createcommand("::tk::mac::ReopenApplication", self.wake_and_type)
        except tk.TclError:
            pass
        self.root.after(33, self._tick)

    def wake_and_type(self):
        self.wake(sound=False)
        self.open_typing()

    def open_typing(self):
        if self.typing is not None and self.typing.winfo_exists():
            self.typing.lift()
            self._type_entry.focus_force()
            return
        t = tk.Toplevel(self.root)
        t.title("Karishma — likh kar poochhiye")
        t.attributes("-topmost", True)
        t.configure(bg="#1f2233")
        t.geometry(f"{W}x58+{self.win_x}+{self.win_y + ORB_CY + ORB_R + 14}")
        entry = tk.Entry(t, font=self.f_answer, relief="flat")
        entry.pack(side="left", fill="x", expand=True, padx=(10, 6), pady=12, ipady=4)

        def send(_e=None):
            text = entry.get().strip()
            if text:
                entry.delete(0, "end")
                self.submit(text, typed=True)

        def close(_e=None):
            t.destroy()
            self.typing = None

        tk.Button(t, text="Bhejo", command=send).pack(side="left", padx=(0, 10))
        entry.bind("<Return>", send)
        t.bind("<Escape>", close)
        t.protocol("WM_DELETE_WINDOW", close)
        self.typing, self._type_entry = t, entry
        t.after(50, entry.focus_force)

    # --- mouse ---
    def _press(self, e):
        self._drag_from = (e.x_root, e.y_root, self.win_x, self.win_y)
        self._moved = False

    def _drag(self, e):
        sx, sy, wx, wy = self._drag_from
        dx, dy = e.x_root - sx, e.y_root - sy
        if abs(dx) + abs(dy) > 4:
            self._moved = True
            self.win_x, self.win_y = wx + dx, wy + dy
            self.root.geometry(f"+{self.win_x}+{self.win_y}")

    def _release(self, e):
        if self._moved:
            return
        on_orb = (e.x - ORB_CX) ** 2 + (e.y - ORB_CY) ** 2 <= (ORB_R + 14) ** 2
        if on_orb:
            # Click the orb = "Hey Karishma": stop talking, listen now, and offer typing.
            self.wake_and_type()
            return
        for x0, y0, x1, y1, url in self._hit:
            if x0 <= e.x <= x1 and y0 <= e.y <= y1 and url:
                subprocess.Popen(["open", url])
                return
        self.toggle_cards()

    def _menu(self, e):
        try:
            self.menu.tk_popup(e.x_root, e.y_root)
        finally:
            self.menu.grab_release()

    # --- menu actions ---
    def ask_typed(self):
        self.wake_and_type()

    def toggle_pause(self):
        self.paused = not self.paused
        if self.paused and self.mouth:
            self.mouth.stop()
        self.set_state("paused" if self.paused else "listening")

    def new_topic(self):
        if self.brain:
            self.brain.reset()
        self.query_text, self.answer_text = "", "Naya topic shuru."

    def toggle_cards(self):
        self.cards_visible = not self.cards_visible
        self.last_activity = time.time()

    def open_settings(self):
        env = Path(__file__).resolve().parent.parent / ".env"
        subprocess.run(["open", "-e", str(env)])
        self.answer_text = "Settings badalne ke baad Karishma ko band karke dobara kholiye."
        self.cards_visible = True

    def quit(self):
        self.stop_all = True
        if self.mouth:
            self.mouth.stop()
        try:
            self.root.destroy()
        finally:
            os._exit(0)

    @property
    def follow_up(self) -> float:
        # On-demand mode closes the mic soon after the conversation, like Siri.
        return min(FOLLOW_UP_WINDOW, 15 if self.cfg.mic_always_on else 10)

    def conversation_active(self) -> bool:
        return (self.cfg.mic_always_on or self.busy.is_set() or self.waiting_answer.is_set()
                or bool(self.mouth and self.mouth.speaking) or time.time() < self.awake_until
                or self.typing is not None)

    def _check_wake_file(self):
        """Siri / keyboard-shortcut trigger: `touch ~/.karishma/wake` (optionally with a command inside)."""
        f = self.cfg.home / "wake"
        if f.exists():
            try:
                text = f.read_text(encoding="utf-8").strip()
                f.unlink()
            except OSError:
                text = ""
            self.wake(sound=not text)
            if text:
                self.submit(text)

    def wake(self, sound: bool = True):
        if self.mouth and self.mouth.speaking:
            self.mouth.stop()
        self.awake_until = time.time() + self.follow_up
        self.cards_visible = True
        self.last_activity = time.time()
        if self.state not in ("thinking", "speaking", "error", "paused"):
            self.set_state("awake")
        if sound and Path("/System/Library/Sounds/Tink.aiff").exists():
            subprocess.Popen(["afplay", "/System/Library/Sounds/Tink.aiff"])

    # --- thread-safe setters ---
    def set_state(self, state: str, status: str | None = None):
        self.state = state
        labels = {
            "starting": "Shuru ho rahi hoon…",
            "listening": "So rahi hoon",
            "awake": "Sun rahi hoon…",
            "hearing": "Sun rahi hoon…",
            "thinking": "Soch rahi hoon…",
            "speaking": "",
            "paused": "Paused — click karke resume",
            "error": "Problem",
        }
        self.status_text = status if status is not None else labels.get(state, "")
        if state in ("hearing", "thinking", "speaking", "error"):
            self.cards_visible = True
            self.last_activity = time.time()

    def show_query(self, text: str):
        self.query_text = text
        self.answer_text = ""
        self.results = []
        self.cards_visible = True
        self.last_activity = time.time()

    def show_results(self, items: list[dict]):
        self.results = [i for i in items if isinstance(i, dict) and i.get("title")][:5]
        self.cards_visible = True
        self.last_activity = time.time()

    def show_answer(self, text: str):
        self.answer_text = text
        self.cards_visible = True
        self.last_activity = time.time()

    # --- drawing ---
    def _tick(self):
        self._ticks = getattr(self, "_ticks", 0) + 1
        if self._ticks % 9 == 0:
            try:
                self._check_wake_file()
            except Exception:  # noqa: BLE001
                log.exception("wake check failed")
        try:
            self._draw()
        except Exception:  # noqa: BLE001
            log.exception("draw failed")
        if not self.stop_all:
            self.root.after(33, self._tick)

    def _draw(self):
        c = self.canvas
        c.delete("all")
        t = time.time() - self.t0
        level = self.ears.level if self.ears else 0.0
        self.smooth_level += (level - self.smooth_level) * 0.35
        lv = self.smooth_level
        st = self.state

        quiet = time.time() - self.last_activity
        typing_open = self.typing is not None
        # auto-hide cards after 20 s of quiet
        if st in ("listening", "awake") and quiet > 20 and not typing_open:
            self.cards_visible = False
        # completely disappear while sleeping (waiting for "Karishma"), like Siri.
        # Give time to read the answer first (longer when result cards are shown).
        hide_after = 15 if self.results else 8
        hide = st == "listening" and not typing_open and quiet > hide_after
        if hide:
            if not self.hidden:
                self.hidden = True
                self._h = 1
                self.root.geometry(f"1x1+{self.win_x + W - 1}+{self.win_y}")
            return
        if self.hidden:
            self.hidden = False
            self._h = None
            self.cards_visible = True

        # ---- orb ----
        if self.frames:
            self._draw_stars(st)
        elif st == "paused":
            r = ORB_R * 0.8
            c.create_oval(ORB_CX - r, ORB_CY - r, ORB_CX + r, ORB_CY + r, fill="#4b5563", outline="#9ca3af", width=2)
            c.create_text(ORB_CX, ORB_CY, text="⏸", fill="white", font=self.f_query)
        elif st == "error":
            r = ORB_R * (0.9 + 0.05 * math.sin(t * 3))
            c.create_oval(ORB_CX - r, ORB_CY - r, ORB_CX + r, ORB_CY + r, fill="#dc2626", outline="#fca5a5", width=2)
            c.create_text(ORB_CX, ORB_CY, text="!", fill="white", font=self.f_query)
        else:
            if st == "listening":
                speed, amp, size = 0.8, 0.05, 0.78 + lv * 0.25
            elif st in ("awake", "hearing"):
                speed, amp, size = 1.6, 0.08, 0.95 + lv * 0.55
            elif st == "thinking":
                speed, amp, size = 4.5, 0.10, 0.95
            elif st == "speaking":
                speed, amp = 2.4, 0.12
                size = 1.0 + 0.12 * abs(math.sin(t * 7.0)) + 0.06 * random.random()
            else:
                speed, amp, size = 1.0, 0.05, 0.85
            base = ORB_R * size
            # outer glow rings
            for i in range(3):
                gr = base + 6 + i * 5 + (lv * 10 if st in ("awake", "hearing") else 0) + 3 * math.sin(t * speed + i)
                col = SIRI[(i + int(t * speed)) % len(SIRI)]
                c.create_oval(ORB_CX - gr, ORB_CY - gr, ORB_CX + gr, ORB_CY + gr, outline=col, width=1.5)
            # dark core
            c.create_oval(ORB_CX - base, ORB_CY - base, ORB_CX + base, ORB_CY + base, fill="#0b0b1a", outline="")
            # swirling colour blobs
            for i, col in enumerate(SIRI[:4]):
                ang = t * speed + i * (math.pi / 2)
                off = base * (0.32 + amp * math.sin(t * 2.1 + i))
                br = base * (0.62 + amp * math.cos(t * 1.7 + i * 1.3) + lv * 0.2)
                bx, by = ORB_CX + off * math.cos(ang), ORB_CY + off * math.sin(ang)
                c.create_oval(bx - br, by - br, bx + br, by + br, fill=col, outline="")
            # glossy highlight + rim
            c.create_oval(ORB_CX - base * 0.45, ORB_CY - base * 0.75, ORB_CX + base * 0.1, ORB_CY - base * 0.35,
                          fill="#ffffff", outline="")
            c.create_oval(ORB_CX - base, ORB_CY - base, ORB_CX + base, ORB_CY + base, outline="#c4b5fd", width=2)

        y = ORB_CY + ORB_R + 26
        if typing_open:
            y += 92  # room for the typing box (its own small window sits here)
        if self.cards_visible:
            if self.status_text:
                c.create_text(W - 14, y, text=self.status_text, fill=SUB, font=self.f_small, anchor="e")
                y += 18
            if self.query_text:
                y = self._card(y, self.query_text, self.f_query, CARD2)
            if self.answer_text:
                y = self._card(y, self.answer_text, self.f_answer, CARD)
            self._hit = []
            if self.results:
                y = self._results(y)
        h = int(max(y + 8, ORB_CY + ORB_R + 30))
        if h != getattr(self, "_h", None):
            self._h = h
            self.canvas.configure(height=h)
            self.root.geometry(f"{W}x{h}+{self.win_x}+{self.win_y}")

    def _card(self, y: float, text: str, font, fill) -> float:
        c = self.canvas
        pad, x0, x1 = 12, 10, W - 10
        if len(text) > 700:
            text = text[:700] + "…"
        tid = c.create_text(x0 + pad, y + pad, text=text, fill=TXT, font=font, anchor="nw", width=x1 - x0 - 2 * pad)
        bx0, by0, bx1, by1 = c.bbox(tid)
        bottom = by1 + pad
        self._round_rect(x0, y, x1, bottom, 14, fill)
        c.tag_raise(tid)
        return bottom + 8

    def _draw_stars(self, st):
        """Only the Lottie sparkle animation - its speed shows what Karishma is doing."""
        now = time.time()
        dt = min(0.2, now - getattr(self, "_last_frame_t", now))
        self._last_frame_t = now
        speed = {"listening": 0.6, "awake": 1.0, "hearing": 1.4, "thinking": 2.4, "speaking": 1.7,
                 "paused": 0.0, "error": 0.3}.get(st, 1.0)
        self._fi = (getattr(self, "_fi", 0.0) + speed * dt * 25) % len(self.frames)
        if self.cfg.star_color == "white":
            fills, outline = ["#ffffff"] * 3, "#a78bfa"
        else:
            fills, outline = ["#d946ef", "#8b5cf6", "#3b82f6"], ""
        x0, y0 = ORB_CX - self.star_size / 2, ORB_CY - self.star_size / 2
        polys = self.frames[int(self._fi)]
        # biggest star first; the small ones keep their colour by side (left / right), so no flicker
        ordered = polys[:1] + sorted(polys[1:], key=lambda p: sum(p[0][0::2]) / max(1, len(p[0]) // 2))
        for n, (pts, _area) in enumerate(ordered):
            moved = [v + (x0 if i % 2 == 0 else y0) for i, v in enumerate(pts)]
            self.canvas.create_polygon(moved, smooth=True, fill=fills[min(n, 2)],
                                       outline=outline, width=1 if outline else 0)

    def _results(self, y: float) -> float:
        """Siri-style list of results: bold title, grey summary, small source; click opens the link."""
        c = self.canvas
        x0, x1, pad = 10, W - 10, 12
        top = y
        items_ids = []
        cy = y + pad
        for n, it in enumerate(self.results):
            title = str(it.get("title", ""))[:90]
            sub = str(it.get("subtitle", ""))[:150]
            src = str(it.get("source") or _domain(it.get("url", "")))[:60]
            ids = [c.create_text(x0 + pad, cy, text=title, fill=TXT, font=self.f_query, anchor="nw",
                                 width=x1 - x0 - 2 * pad)]
            cy = c.bbox(ids[-1])[3] + 2
            if sub:
                ids.append(c.create_text(x0 + pad, cy, text=sub, fill=SUB, font=self.f_answer, anchor="nw",
                                         width=x1 - x0 - 2 * pad))
                cy = c.bbox(ids[-1])[3] + 2
            if src:
                ids.append(c.create_text(x0 + pad, cy, text=src, fill="#7c84a8", font=self.f_small, anchor="nw"))
                cy = c.bbox(ids[-1])[3]
            item_top = c.bbox(ids[0])[1] - 4
            self._hit.append((x0, item_top, x1, cy + 4, it.get("url", "")))
            items_ids += ids
            cy += 10
            if n < len(self.results) - 1:
                items_ids.append(c.create_line(x0 + pad, cy, x1 - pad, cy, fill="#3a3f5c"))
                cy += 10
        bottom = cy + pad - 10
        self._round_rect(x0, top, x1, bottom, 14, CARD)
        for i in items_ids:
            c.tag_raise(i)
        return bottom + 8

    def _round_rect(self, x0, y0, x1, y1, r, fill):
        pts = [x0 + r, y0, x1 - r, y0, x1, y0, x1, y0 + r, x1, y1 - r, x1, y1, x1 - r, y1,
               x0 + r, y1, x0, y1, x0, y1 - r, x0, y0 + r, x0, y0]
        self.canvas.create_polygon(pts, smooth=True, fill=fill, outline="")

    def run(self):
        self.root.mainloop()

    # ======================= logic (background threads) =======================
    def submit(self, text: str, typed: bool = False):
        """A new command: cancel whatever Karishma is doing and do this instead."""
        self.show_query(text)
        if self.mouth and self.mouth.speaking:
            self.mouth.stop()
        if self.busy.is_set() and self.brain:
            self.brain.cancel.set()
        # drop older pending jobs - only the newest command matters
        while not self.jobs.empty():
            try:
                self.jobs.get_nowait()
            except queue.Empty:
                break
        self.jobs.put(text)
        self.awake_until = time.time() + self.follow_up

    def begin_answer(self):
        while not self.answers.empty():
            try:
                self.answers.get_nowait()
            except queue.Empty:
                break
        self.waiting_answer.set()

    def wait_for_answer(self, timeout: float) -> str:
        if not self.waiting_answer.is_set():
            self.begin_answer()
        self.set_state("awake", "Boliye… (haan / nahi)")
        try:
            return self.answers.get(timeout=timeout)
        except queue.Empty:
            return ""
        finally:
            self.waiting_answer.clear()

    def _startup(self):
        try:
            cfg = self.cfg
            if not cfg.elevenlabs_api_key or (cfg.brain_provider == "claude" and not cfg.anthropic_api_key
                                              and not cfg.backup_brains):
                self.set_state("error", "API keys missing — right-click > Settings")
                return
            from .voice import Ears

            self.mouth = Mouth(cfg)
            self.set_state("starting", "Mic check… 1 second shaant rahiye")
            self.ears = Ears(cfg)
            if self.ears.mic_blocked:
                self.set_state("error", "Microphone permission chahiye")
                self.show_answer("Mujhe microphone ki permission nahi mili. System Settings > Privacy & Security > "
                                 "Microphone me Karishma ko ON kariye.")
                self.mouth.speak("Mujhe microphone ki permission nahi mili. Settings me Karishma ko ON kar dijiye.")
                subprocess.run(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"])
                while self.ears.mic_blocked and not self.stop_all:
                    time.sleep(5)
                    self.ears.calibrate()
            self.brain, self.browser = build(cfg, self.io)
            threading.Thread(target=self._brain_loop, daemon=True).start()
            threading.Thread(target=self._listen_loop, daemon=True).start()
        except Exception as e:  # noqa: BLE001
            log.exception("startup failed")
            self.set_state("error", str(e)[:80])
            self.show_answer(f"Error: {e}")

    def _brain_loop(self):
        self.jobs.put("__greet__")
        while not self.stop_all:
            text = self.jobs.get()
            if text == "__greet__":
                self.io.say(greeting(self.cfg))
                self.awake_until = time.time() + self.follow_up
                self.set_state("awake")
                continue
            self.busy.set()
            self.brain.cancel.clear()
            try:
                if RESET_WORDS.search(text):
                    self.brain.reset()
                    self.io.say("Theek hai, naya topic.")
                    continue
                quick = fastpath.handle(text) if self.cfg.is_mac else None
                if quick:  # everyday command done instantly, no AI round-trip
                    log.info("fastpath: %s -> %s", text, quick)
                    self.io.say(quick)
                    self.awake_until = time.time() + self.follow_up
                    continue
                self.set_state("thinking")
                self.brain.on_status = lambda s: self.set_state("thinking", _friendly(s))
                reply = self.brain.handle(text)
                if reply is None or not self.jobs.empty():
                    continue  # cancelled / a newer command is waiting
                self.io.say(reply)
                self.awake_until = time.time() + self.follow_up
            except Exception as e:  # noqa: BLE001
                log.exception("job failed")
                self.show_answer(f"Error: {e}")
            finally:
                self.busy.clear()
                if not self.paused and self.state not in ("speaking", "error"):
                    self.set_state("awake" if time.time() < self.awake_until else "listening")

    def _listen_loop(self):
        ears, mouth, cfg = self.ears, self.mouth, self.cfg

        flag = {"over_voice": False}

        def barge_in():
            # Someone started talking while Karishma talks. With headphones it's surely the user ->
            # stop at once. On the laptop speakers it may be her own echo -> decide after
            # transcribing (needs "Karishma…" or "ruko/bas").
            flag["over_voice"] = mouth.speaking
            if mouth.speaking:
                if not output_is_speakers():
                    mouth.stop()
                return
            if self.busy.is_set() or self.waiting_answer.is_set() or time.time() < self.awake_until:
                self.set_state("hearing")

        while not self.stop_all:
            if self.paused:
                time.sleep(0.3)
                continue
            if not self.conversation_active():
                # Microphone fully OFF (no orange dot) until "Hey Siri, Karishma", the keyboard
                # shortcut, a click on the face or the Dock icon wakes her.
                if self.state in ("awake", "hearing"):
                    self.set_state("listening")
                time.sleep(0.2)
                continue
            flag["over_voice"] = False
            heard = ears.listen(max_wait=3, echo_guard=lambda: mouth.speaking or time.time() - mouth.last_end < 0.6,
                                on_start=barge_in)
            if ears.last_error:
                self.set_state("error", "Sun nahi pa rahi")
                self.show_answer(ears.last_error)
                ears.last_error = ""
                time.sleep(3)
                continue
            if not heard:
                if (self.state == "awake" and time.time() > self.awake_until and not self.busy.is_set()
                        and not self.waiting_answer.is_set() and not mouth.speaking):
                    self.set_state("listening")  # nothing said for a while -> sleep & hide
                if self.state == "hearing":
                    self.set_state("thinking" if self.busy.is_set() else
                                   ("awake" if time.time() < self.awake_until else "listening"))
                continue
            log.info("heard: %s", heard)
            near_voice = flag["over_voice"] or mouth.speaking or time.time() - mouth.last_end < 1.5
            action, text = route(
                heard, cfg,
                over_voice=flag["over_voice"], near_voice=near_voice, speakers=output_is_speakers(),
                said=self.answer_text, waiting_answer=self.waiting_answer.is_set(),
                awake=(not cfg.mic_always_on) or time.time() < self.awake_until,
                busy=self.busy.is_set(),
            )
            log.info("route: %s %r", action, text)
            if action == "ignore":
                if self.state == "hearing":
                    self.set_state("thinking" if self.busy.is_set() else
                                   ("awake" if time.time() < self.awake_until else "listening"))
                continue
            if mouth.speaking:
                mouth.stop()
            if action == "answer":
                self.show_query(heard)
                self.answers.put(text)
            elif action == "wake":
                self.wake(sound=True)
                self.show_query(heard)
                self.set_state("awake", "Ji, boliye…")
            elif action == "hush":
                if self.brain:
                    self.brain.cancel.set()
                self.show_query(heard)
                self.show_answer("Theek hai, ruk gayi.")
                self.awake_until = time.time() + self.follow_up
                self.set_state("awake")
            elif action == "bye":
                self.awake_until = 0
                self.show_query(heard)
                self.show_answer("Theek hai. Jab zarurat ho 'Karishma' boliye.")
                self.set_state("listening")
            else:  # command
                self.submit(text)


def _domain(url: str) -> str:
    m = re.match(r"https?://(www\.)?([^/]+)", url or "")
    return m.group(2) if m else ""


def _friendly(status: str) -> str:
    s = status.replace("[tool] ", "")
    return {
        "web_search": "Internet par dhoondh rahi hoon…",
        "web_fetch": "Page padh rahi hoon…",
        "browser": "Browser me kaam kar rahi hoon…",
        "run_applescript": "Mac par kar rahi hoon…",
        "run_shell": "Mac par kar rahi hoon…",
        "open_item": "Khol rahi hoon…",
        "screenshot_screen": "Screen dekh rahi hoon…",
        "remember": "Yaad kar rahi hoon…",
    }.get(s, s[:60] if s else "Soch rahi hoon…")


def main() -> None:
    OrbApp().run()


if __name__ == "__main__":
    main()
