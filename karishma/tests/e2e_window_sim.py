# Run: python tests/e2e_window_sim.py   (needs tkinter + a display; on Linux use xvfb-run)
"""End-to-end: real OrbApp threads + UI, fake mic/speaker/Claude, scripted conversation."""
import os, sys, time, threading
os.environ.update(KARISHMA_HOME="/tmp/karishma_e2e", ANTHROPIC_API_KEY="x", ELEVENLABS_API_KEY="y",
                  KARISHMA_USER_NAME="Satish")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import karishma.window as w
import karishma.voice as v
v.output_is_speakers = lambda: True
w.output_is_speakers = lambda: True

events = []
def ev(*a):
    events.append((round(time.time() - T0, 1),) + a); print(events[-1], flush=True)

class FakeMouth(v.Mouth):
    def __init__(self, cfg):
        self.cfg = cfg; self._proc = None; self.speaking = False; self.interrupted = False; self.last_end = 0.0
    def _speak(self, text):
        ev("SPEAK", text[:40]); self._run(["sleep", "2.5"])
        ev("STOPPED" if self.interrupted else "SPOKE_FULL", text[:25])

# Script: (delay_before_s, text, starts_while_speaking?)
SCRIPT = [
    (0.8, "Good evening Satish Main Karishma hoon", True),     # her own echo during greeting -> ignore
    (2.5, "Karishma Delhi ki flight dhundo", False),            # command
    (1.6, "acha theek hai", True),                              # random talk while she answers -> ignore
    (0.3, "Karishma ruko", True),                               # hush -> stop her
    (1.0, "Spotify chalao", False),                             # follow-up command (awake window)
    (0.4, "nahi YouTube kholo", False),                         # new command while busy -> cancels Spotify
]
class FakeEars:
    level = 0.0; last_error = ""; mic_blocked = False
    def __init__(self): self.i = 0
    def listen(self, max_wait=3, echo_guard=None, on_start=None):
        if self.i >= len(SCRIPT):
            time.sleep(max_wait); return ""
        delay, text, _ = SCRIPT[self.i]; self.i += 1
        time.sleep(delay)
        if on_start: on_start()
        time.sleep(0.4)  # user still talking + STT
        ev("HEARD", text)
        return text

class FakeBrain:
    def __init__(self): self.cancel = threading.Event(); self.on_status = None
    def reset(self): pass
    def handle(self, text):
        ev("BRAIN_START", text)
        for _ in range(15):
            if self.cancel.is_set():
                ev("BRAIN_CANCELLED", text); return None
            time.sleep(0.1)
        ev("BRAIN_DONE", text)
        return f"Jawab: {text} ho gaya. Yeh ek lamba jawab hai jo poora bolna chahiye."

def fake_startup(self):
    self.mouth = FakeMouth(self.cfg); self.ears = FakeEars()
    self.brain = FakeBrain(); self.browser = type("B", (), {"close": lambda s: None})()
    threading.Thread(target=self._brain_loop, daemon=True).start()
    threading.Thread(target=self._listen_loop, daemon=True).start()
w.OrbApp._startup = fake_startup
T0 = time.time()
app = w.OrbApp()
D = "/tmp/"
def finish():
    time.sleep(16)
    os.system(f"import -window root {D}e2e.png")
    names = [e[1] for e in events]
    texts = [(e[1], e[2]) for e in events]
    ok = True
    def check(cond, msg):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + msg); ok &= cond
    check(any(e[1]=="SPOKE_FULL" and e[2].startswith("Good evening") for e in events), "greeting not cut by its own echo")
    check(("BRAIN_START", "Delhi ki flight dhundo") in texts, "wake-word command runs")
    check(any(e[1]=="STOPPED" and e[2].startswith("Jawab: Delhi") for e in events), "'Karishma ruko' stopped her answer")
    check(not any(e[1]=="BRAIN_START" and "acha" in e[2] for e in events), "random talk while speaking ignored")
    check(("BRAIN_CANCELLED", "Spotify chalao") in texts, "new command cancels running job")
    check(("BRAIN_DONE", "nahi YouTube kholo") in texts, "newest command completed")
    check(any(e[1]=="SPOKE_FULL" and "YouTube" in e[2] for e in events), "final answer spoken fully")
    print("ALL OK" if ok else "SOME FAILED", flush=True)
    os._exit(0 if ok else 1)
threading.Thread(target=finish, daemon=True).start()
app.run()
