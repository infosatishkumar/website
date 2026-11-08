# Renders every face expression to PNGs: python tests/render_faces.py /tmp/  (needs tkinter + display + ImageMagick)
import os, sys, time, threading
os.environ.update(KARISHMA_HOME="/tmp/kh_faces", ANTHROPIC_API_KEY="", ELEVENLABS_API_KEY="")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import karishma.window as w
w.OrbApp._startup = lambda self: None
D = sys.argv[1]
states = ["listening_idle", "awake", "hearing", "thinking", "speaking", "happy", "error", "paused"]
apps = []
app = w.OrbApp()
app.win_x, app.win_y = 0, 0
class M: speaking=False; last_end=0.0
class E: level=0.6
app.mouth = M(); app.ears = E()
app.cards_visible = False
def run():
    for i, st in enumerate(states):
        app.last_activity = time.time()
        if st == "happy":
            app.mouth.last_end = time.time(); app.set_state("awake")
        elif st == "listening_idle":
            app.set_state("awake"); app.ears.level = 0.0
        else:
            app.ears.level = 0.6; app.set_state(st)
        app.cards_visible = False
        time.sleep(0.45)
        os.system(f"import -window root -crop 130x130+{w.W-123}+0 {D}face_{i}_{st}.png")
    os._exit(0)
threading.Thread(target=run, daemon=True).start()
app.run()
