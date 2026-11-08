# Run: python tests/e2e_window_sim3.py   (needs tkinter + a display; on Linux use xvfb-run)
"""Scenario 3 (the user's report): say "bye" -> she hides; later say just "Karishma" -> she comes back."""
import os, sys, time, threading
os.environ.update(KARISHMA_HOME="/tmp/karishma_e2e3", ANTHROPIC_API_KEY="x", ELEVENLABS_API_KEY="y",
                  KARISHMA_USER_NAME="Satish", KARISHMA_MIC_ALWAYS_ON="true")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import karishma.window as w
import karishma.voice as v
w.output_is_speakers = lambda: True

T0 = time.time()
events = []
def ev(*a):
    events.append((round(time.time() - T0, 1),) + a); print(events[-1], flush=True)

class FakeMouth(v.Mouth):
    def __init__(self, cfg):
        self.cfg = cfg; self._proc = None; self.speaking = False; self.interrupted = False; self.last_end = 0.0
    def _speak(self, text):
        ev("SPEAK", text[:50]); self._run(["sleep", "2"])

SCRIPT = [(4.0, "bye"), ("AFTER_HIDDEN", "Karishma"), (1.0, "aaj ka mausam batao")]
class FakeEars:
    level = 0.0; last_error = ""; mic_blocked = False
    def __init__(self): self.i = 0
    def listen(self, max_wait=3, echo_guard=None, on_start=None):
        if self.i >= len(SCRIPT):
            time.sleep(1); return ""
        delay, text = SCRIPT[self.i]
        if delay == "AFTER_HIDDEN":
            if not app.hidden:
                time.sleep(0.5); return ""
            time.sleep(2); delay = 0
        self.i += 1; time.sleep(delay)
        if on_start: on_start()
        time.sleep(0.3); ev("HEARD", text); return text

class FakeBrain:
    def __init__(self): self.cancel = threading.Event(); self.on_status = None
    def reset(self): pass
    def handle(self, text):
        ev("BRAIN", text); time.sleep(0.5); return "Aaj Bangalore me 21 degree aur badal hain."

def fake_startup(self):
    self.mouth = FakeMouth(self.cfg); self.ears = FakeEars()
    self.brain = FakeBrain(); self.browser = type("B", (), {"close": lambda s: None})()
    threading.Thread(target=self._brain_loop, daemon=True).start()
    threading.Thread(target=self._listen_loop, daemon=True).start()
w.OrbApp._startup = fake_startup
app = w.OrbApp()
app.win_x, app.win_y = 20, 10

def watcher():
    was = False
    while True:
        if app.hidden != was:
            was = app.hidden; ev("HIDDEN" if was else "SHOWN")
        time.sleep(0.1)
threading.Thread(target=watcher, daemon=True).start()

def finish():
    time.sleep(30)
    names = [e[1] for e in events]
    ok = True
    def check(cond, msg):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + msg); ok &= cond
    hid = [e[0] for e in events if e[1] == "HIDDEN"]
    karishma = [e[0] for e in events if e[1] == "HEARD" and e[2] == "Karishma"]
    shown_after = [e[0] for e in events if e[1] == "SHOWN" and karishma and e[0] >= karishma[0] - 0.5]
    check(bool(hid), "'bye' -> she hid")
    check(bool(karishma) and karishma[0] > hid[0], "'Karishma' heard while hidden")
    check(bool(shown_after), "'Karishma' brought her back")
    check(("BRAIN", "aaj ka mausam batao") in [(e[1], e[2] if len(e) > 2 else None) for e in events],
          "next command (without saying Karishma again) was done")
    check(not any(e[1] == "BRAIN" and e[2] == "bye" for e in events), "'bye' was not sent to Claude")
    print("ALL OK" if ok else "SOME FAILED", flush=True)
    os._exit(0 if ok else 1)
threading.Thread(target=finish, daemon=True).start()
app.run()
