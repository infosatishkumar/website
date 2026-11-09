# Run: python tests/e2e_window_sim4.py   (needs tkinter, a display and espeak-ng; on Linux use xvfb-run)
"""Scenario 4: first launch learns the owner's voice; afterwards background voices are ignored."""
import os, sys, time, threading, subprocess, tempfile, wave
import numpy as np
os.environ.update(KARISHMA_HOME=tempfile.mkdtemp(prefix="karishma_e2e4_"), ANTHROPIC_API_KEY="x",
                  ELEVENLABS_API_KEY="y", KARISHMA_USER_NAME="Satish", KARISHMA_MIC_ALWAYS_ON="true")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import karishma.window as w
import karishma.voice as v
w.output_is_speakers = lambda: True
TMP = tempfile.mkdtemp()

def speak_wav(voice, text):
    f = os.path.join(TMP, f"{abs(hash((voice, text)))}.wav")
    subprocess.run(["espeak-ng", "-v", voice, "-s", "150", "-w", f, text], check=True)
    with wave.open(f) as wf:
        sr = wf.getframerate(); x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32)
    n = int(len(x) * 16000 / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.int16)

OWNER, OTHER_F, OTHER_M = "hi+m3", "hi+f2", "hi+f4"
T0 = time.time(); events = []
def ev(*a):
    events.append((round(time.time() - T0, 1),) + a); print(events[-1], flush=True)

class FakeMouth(v.Mouth):
    def __init__(self, cfg):
        self.cfg = cfg; self._proc = None; self.speaking = False; self.interrupted = False; self.last_end = 0.0
    def _speak(self, text):
        ev("SPEAK", text[:45]); self._run(["sleep", "0.6"])

ENROLL = [speak_wav(OWNER, l) for l in w.OrbApp.ENROLL_LINES]
SCRIPT = [  # (who, wav, what STT would return)
    ("owner", speak_wav(OWNER, "Karishma YouTube par gaane chalao"), "Karishma YouTube par gaane chalao"),
    ("background woman", speak_wav(OTHER_F, "Karishma mere liye pizza order karo"), "Karishma mere liye pizza order karo"),
    ("background woman 2", speak_wav(OTHER_M, "Karishma Spotify band kar do abhi"), "Karishma Spotify band kar do abhi"),
    ("owner", speak_wav(OWNER, "Karishma aaj ki top news batao"), "Karishma aaj ki top news batao"),
]
class FakeEars:
    level = 0.0; last_error = ""; mic_blocked = False; threshold = 400.0
    def __init__(self): self.i = 0; self.e = 0; self.last_pcm = None; self.verifier = None; self.rejected = 0
    def record(self, max_wait=30, max_len=30, **kw):
        time.sleep(0.4); self.last_pcm = ENROLL[self.e]; self.e += 1; ev("ENROLL_LINE", self.e); return b"RIFF"
    def listen(self, max_wait=3, echo_guard=None, on_start=None):
        if self.i >= len(SCRIPT):
            time.sleep(1); return ""
        who, pcm, text = SCRIPT[self.i]; self.i += 1
        time.sleep(1.2)
        self.last_pcm = pcm
        if self.verifier and not self.verifier(pcm):
            self.rejected += 1; ev("IGNORED", who); return ""
        ev("HEARD", who, text); return text

class FakeBrain:
    def __init__(self): self.cancel = threading.Event(); self.on_status = None
    def reset(self): pass
    def handle(self, text):
        ev("BRAIN", text); return "Ho gaya."

def fake_startup(self):
    self.mouth = FakeMouth(self.cfg); self.ears = FakeEars()
    self._setup_voice_check()
    self.brain = FakeBrain(); self.browser = type("B", (), {"close": lambda s: None})()
    threading.Thread(target=self._brain_loop, daemon=True).start()
    threading.Thread(target=self._listen_loop, daemon=True).start()
w.OrbApp._startup = fake_startup
app = w.OrbApp(); app.win_x, app.win_y = 20, 10

def finish():
    time.sleep(22)
    ok = True
    def check(cond, msg):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + msg); ok &= cond
    brain = [e[2] for e in events if e[1] == "BRAIN"]
    check((app.cfg.home / "voice_profile.json").exists(), "first launch learned the owner's voice (profile saved)")
    check(sum(1 for e in events if e[1] == "ENROLL_LINE") == 4, "owner read 4 lines")
    check("YouTube par gaane chalao" in brain and "aaj ki top news batao" in brain, "owner's commands were done")
    check(not any("pizza" in b or "Spotify" in b for b in brain), "background voices were ignored")
    check(app.ears.rejected == 2, f"2 background utterances rejected (got {app.ears.rejected})")
    print("ALL OK" if ok else "SOME FAILED", flush=True)
    os._exit(0 if ok else 1)
threading.Thread(target=finish, daemon=True).start()
app.run()
