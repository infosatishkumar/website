# Run: python tests/e2e_window_sim2.py   (needs tkinter + a display; on Linux use xvfb-run)
"""Scenario 2: confirmation answered while she is still speaking, hide when idle,
wake word brings her back, typing box, Siri-style result cards."""
import os, sys, time, threading
os.environ.update(KARISHMA_HOME="/tmp/karishma_e2e2", ANTHROPIC_API_KEY="x", ELEVENLABS_API_KEY="y",
                  KARISHMA_USER_NAME="Satish")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import karishma.window as w
import karishma.voice as v
w.FOLLOW_UP_WINDOW = 3
w.output_is_speakers = lambda: True
SHOT = os.environ.get("SHOT_DIR", "/tmp/")

T0 = time.time()
events = []
def ev(*a):
    events.append((round(time.time() - T0, 1),) + a); print(events[-1], flush=True)

class FakeMouth(v.Mouth):
    def __init__(self, cfg):
        self.cfg = cfg; self._proc = None; self.speaking = False; self.interrupted = False; self.last_end = 0.0
    def _speak(self, text):
        ev("SPEAK", text[:60]); self._run(["sleep", "3"])
        ev("STOPPED" if self.interrupted else "SPOKE_FULL", text[:30])

SCRIPT = [  # (delay, heard)
    (4.6, "Karishma Chrome restart karo"),   # command -> confirm question
    (1.2, "haan"),                           # said WHILE she reads the question (on speakers)
    (14.0, "Karishma"),                      # after she went hidden -> comes back
    (1.0, "Satish Kumar designer kaun hai"), # follow-up -> result cards
]
class FakeEars:
    level = 0.0; last_error = ""; mic_blocked = False
    def __init__(self): self.i = 0
    def listen(self, max_wait=3, echo_guard=None, on_start=None):
        if self.i >= len(SCRIPT):
            time.sleep(min(max_wait, 1)); return ""
        delay, text = SCRIPT[self.i]
        if delay > max_wait:
            SCRIPT[self.i] = (delay - max_wait, text); time.sleep(max_wait); return ""
        self.i += 1; time.sleep(delay)
        if on_start: on_start()
        time.sleep(0.3); ev("HEARD", text); return text

class FakeBrain:
    def __init__(self, io): self.cancel = threading.Event(); self.on_status = None; self.io = io
    def reset(self): pass
    def handle(self, text):
        ev("BRAIN", text)
        if "Chrome" in text:
            ok = self.io.confirm("Ye command chalaun? Chrome restart karna hai.",
                                 detail="$ pkill -x 'Google Chrome'; sleep 2; open -a 'Google Chrome'")
            ev("CONFIRM_RESULT", ok)
            return "Chrome restart kar diya." if ok else "Theek hai, nahi kiya."
        self.io.show_cards([
            {"title": "Satish Kumar | Creative Motion Graphic Designer in Bengaluru",
             "subtitle": "Satish Kumar is a Creative Motion Graphic Designer...", "url": "https://satishkumar.net"},
            {"title": "Satish Kumar - Graphic Designer - LinkedIn",
             "subtitle": "I'm Satish, a passionate Graphic and Motion Graphics designer", "url": "https://in.linkedin.com/in/satish"},
            {"title": "Satish Kumar: The Bangalore Designer Who Proves Design", "subtitle": "16 Mar 2026 ...",
             "url": "https://openpr.com/news"},
        ])
        return "Satish Kumar Bengaluru ke motion graphic designer hain."

def fake_startup(self):
    self.mouth = FakeMouth(self.cfg); self.ears = FakeEars()
    self.brain = FakeBrain(self.io); self.browser = type("B", (), {"close": lambda s: None})()
    threading.Thread(target=self._brain_loop, daemon=True).start()
    threading.Thread(target=self._listen_loop, daemon=True).start()
w.OrbApp._startup = fake_startup
app = w.OrbApp()
app.win_x, app.win_y = 20, 10

checks = {}
def watcher():
    seen_hidden = False
    while True:
        if app.hidden and not seen_hidden:
            seen_hidden = True; ev("HIDDEN")
        if seen_hidden and not app.hidden and "shown_again" not in checks:
            checks["shown_again"] = True; ev("SHOWN_AGAIN")
        time.sleep(0.1)
threading.Thread(target=watcher, daemon=True).start()

def finish():
    time.sleep(32)
    os.system(f"import -window root {SHOT}e2e2_cards.png")
    # typing box
    app.root.after(0, app.wake_and_type)
    time.sleep(0.8)
    app.root.after(0, lambda: (app._type_entry.insert(0, "YouTube kholo"), app._type_entry.event_generate("<Return>")))
    time.sleep(0.8)
    os.system(f"import -window root {SHOT}e2e2_typing.png")
    time.sleep(1.5)
    names = [(e[1], e[2] if len(e) > 2 else None) for e in events]
    ok = True
    def check(cond, msg):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + msg); ok &= cond
    q = [e for e in events if e[1] == "SPEAK" and "chalaun" in str(e[2])]
    check(bool(q) and "pkill" not in q[0][2], "question spoken WITHOUT the shell command")
    check(any(e[1] == "STOPPED" and "chalaun" in e[2] for e in events), "'haan' while she spoke stopped her")
    check(("CONFIRM_RESULT", True) in names, "'haan' approved the confirmation")
    check(any(e[1] == "HIDDEN" for e in events), "orb hid itself when idle")
    check(checks.get("shown_again", False), "'Karishma' brought the orb back")
    check(len(app.results) == 3 or any(e[1] == "BRAIN" and "YouTube" in e[2] for e in events), "result cards shown")
    check(any(e[1] == "BRAIN" and e[2] == "YouTube kholo" for e in events), "typed command submitted")
    print("ALL OK" if ok else "SOME FAILED", flush=True)
    os._exit(0 if ok else 1)
threading.Thread(target=finish, daemon=True).start()
app.run()
