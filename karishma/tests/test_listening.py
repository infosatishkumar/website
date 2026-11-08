"""Tests for listening / interrupting / cancelling behaviour (runs without a Mac or microphone)."""

from __future__ import annotations

import sys
import threading
import time
import types
from types import SimpleNamespace as NS

import numpy as np
import pytest

from karishma.config import Config
from karishma.listening import route


@pytest.fixture
def cfg(tmp_path):
    return Config(anthropic_api_key="t", elevenlabs_api_key="e", home=tmp_path)


SAID = "Kal subah chhe baje IndiGo ki flight sabse sasti hai, char hazaar do sau pachaas rupaye. Kaunsi book karun?"


def r(heard, cfg, **kw):
    base = dict(over_voice=False, near_voice=False, speakers=True, said=SAID,
                waiting_answer=False, awake=False, busy=False)
    base.update(kw)
    return route(heard, cfg, **base)


# ---------- the bug the user hit: she stopped by herself while talking ----------
def test_own_echo_while_speaking_is_ignored(cfg):
    assert r("IndiGo ki flight sabse sasti hai char hazaar", cfg, over_voice=True, near_voice=True)[0] == "ignore"


def test_random_sound_while_speaking_on_speakers_does_not_stop_her(cfg):
    # e.g. TV / someone else talking / garbled echo that STT turned into other words
    for heard in ["acha theek hai", "haan", "kya hua yaar", "hello"]:
        assert r(heard, cfg, over_voice=True, near_voice=True, awake=True)[0] == "ignore", heard


def test_echo_right_after_she_finished_is_ignored(cfg):
    assert r("Kaunsi book karun flight sasti", cfg, near_voice=True, awake=True)[0] == "ignore"


# ---------- deliberate interruptions still work ----------
def test_wake_word_interrupts_on_speakers(cfg):
    assert r("Karishma, Mumbai ki flight dikhao", cfg, over_voice=True, near_voice=True) == ("command", "Mumbai ki flight dikhao")


@pytest.mark.parametrize("heard", ["ruko", "Bas!", "Karishma ruko", "stop"])
def test_hush_stops(cfg, heard):
    assert r(heard, cfg, over_voice=True, near_voice=True)[0] == "hush"


def test_headphones_any_speech_interrupts(cfg):
    assert r("Mumbai ki flight dikhao", cfg, over_voice=True, near_voice=True, speakers=False) == ("command", "Mumbai ki flight dikhao")


# ---------- normal flow ----------
def test_sleeping_needs_wake_word(cfg):
    assert r("aaj khana kya banega", cfg)[0] == "ignore"
    assert r("Karishma", cfg) == ("wake", "")
    assert r("Karishma volume 30 kar do", cfg) == ("command", "volume 30 kar do")


def test_follow_up_without_wake_word(cfg):
    assert r("aur Mumbai ka?", cfg, awake=True) == ("command", "aur Mumbai ka?")


def test_new_command_while_working(cfg):
    assert r("YouTube band karo aur Spotify chalao", cfg, busy=True) == ("command", "YouTube band karo aur Spotify chalao")
    assert r("hmm", cfg, busy=True)[0] == "ignore"   # stray noise doesn't cancel her work


def test_answer_to_confirmation(cfg):
    assert r("haan kar do", cfg, waiting_answer=True) == ("answer", "haan kar do")


def test_bye(cfg):
    assert r("bye", cfg, awake=True)[0] == "bye"


# ---------- Mouth.stop really stops playback ----------
def test_mouth_stop_interrupts_quickly(cfg, monkeypatch):
    from karishma.voice import Mouth

    m = Mouth(Config(home=cfg.home))  # no ElevenLabs key -> no network
    monkeypatch.setattr(m, "_speak", lambda text: m._run(["sleep", "5"]))
    th = threading.Thread(target=m.speak, args=("ek lamba jawab",))
    t0 = time.time()
    th.start()
    time.sleep(0.3)
    assert m.speaking
    m.stop()
    th.join(2)
    assert not th.is_alive() and time.time() - t0 < 1.5
    assert not m.speaking and m.interrupted and m.last_end > 0


# ---------- Ears.record with a fake microphone ----------
class FakeStream:
    """Feeds 50 ms blocks with the given RMS levels."""

    def __init__(self, levels):
        self.levels = list(levels)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self, n):
        lvl = self.levels.pop(0) if self.levels else 0
        rng = np.random.default_rng(0)
        data = (rng.standard_normal((n, 1)) * lvl).astype(np.int16)
        return data, False


def make_ears(monkeypatch, cfg, levels):
    fake_sd = types.ModuleType("sounddevice")
    fake_sd.InputStream = lambda **kw: FakeStream(levels)
    monkeypatch.setitem(sys.modules, "sounddevice", fake_sd)
    from karishma.voice import Ears

    e = Ears.__new__(Ears)
    e.cfg, e.threshold, e.level, e.last_error, e.mic_blocked = cfg, 400.0, 0.0, "", False
    return e


def test_record_normal_speech(monkeypatch, cfg):
    levels = [50] * 4 + [3000] * 20 + [50] * 30
    e = make_ears(monkeypatch, cfg, levels)
    started = []
    wav = e.record(max_wait=5, on_start=lambda: started.append(1))
    assert wav and wav[:4] == b"RIFF" and started == [1]


def test_record_ignores_moderate_echo_when_guarded(monkeypatch, cfg):
    # her voice from the speaker at ~2x threshold must NOT count as the user speaking
    levels = [900] * 60
    e = make_ears(monkeypatch, cfg, levels)
    started = []
    assert e.record(max_wait=2, echo_guard=lambda: True, on_start=lambda: started.append(1)) is None
    assert started == []


def test_record_short_click_is_ignored(monkeypatch, cfg):
    levels = [50] * 3 + [5000] * 1 + [50] * 60
    e = make_ears(monkeypatch, cfg, levels)
    assert e.record(max_wait=2) is None


# ---------- Brain cancel ----------
def test_brain_cancel_mid_task_then_new_command(cfg):
    from karishma.main import build

    calls = []

    def create(**kw):
        calls.append(kw)
        n = len(calls)
        if n == 1:   # first command -> a tool call; during it the user gives a new command
            return NS(stop_reason="tool_use", content=[NS(type="tool_use", id="t1", name="recall", input={})])
        return NS(stop_reason="end_turn", content=[NS(type="text", text="Spotify chala diya.")])

    client = NS(beta=NS(messages=NS(create=create)))
    io = NS(say=lambda t: None, ask=lambda q: "", confirm=lambda s: False)
    brain, browser = build(cfg, io, client=client)
    real_exec = brain.tools.execute

    def exec_and_cancel(name, args):
        brain.cancel.set()           # user spoke a new command while the tool ran
        return real_exec(name, args)

    brain.tools.execute = exec_and_cancel
    assert brain.handle("Delhi ki flight dhundo") is None   # cancelled, nothing spoken
    brain.tools.execute = real_exec
    brain.cancel.clear()
    assert brain.handle("Spotify chalao") == "Spotify chala diya."
    # history stays valid: every tool_use has its tool_result, roles alternate correctly
    msgs = calls[-1]["messages"]
    assert msgs[0]["role"] == "user"
    for i, m in enumerate(msgs):
        if m["role"] == "assistant" and any(getattr(b, "type", "") == "tool_use" for b in m["content"]):
            nxt = msgs[i + 1]["content"]
            assert nxt[0]["type"] == "tool_result"
    browser.close()


def test_output_device_detection(monkeypatch):
    import karishma.voice as v

    for name, expect in [("MacBook Pro Speakers", True), ("AirPods Pro", False), ("External Headphones", False)]:
        fake_sd = types.ModuleType("sounddevice")
        fake_sd.query_devices = lambda kind=None, n=name: {"name": n}
        monkeypatch.setitem(sys.modules, "sounddevice", fake_sd)
        v._OUT_CACHE["t"] = 0
        assert v.output_is_speakers() is expect, name


# ---------- answering a question while she is still reading it ----------
@pytest.mark.parametrize("heard,expected", [("haan", "answer"), ("Haan kar do", "answer"), ("nahi", "answer"),
                                            ("haan ya nahi", "ignore")])
def test_yes_no_while_she_asks(cfg, heard, expected):
    said = "Ye command chalaun? Chrome band karke dobara kholna hai. Haan ya nahi?"
    assert r(heard, cfg, over_voice=True, near_voice=True, waiting_answer=True, said=said)[0] == expected


def test_other_talk_during_question_on_speakers_ignored(cfg):
    said = "Ye command chalaun? Haan ya nahi?"
    assert r("kya hua", cfg, over_voice=True, near_voice=True, waiting_answer=True, said=said)[0] == "ignore"


def test_confirm_does_not_speak_the_command(tmp_path):
    from karishma.config import Config
    from karishma.tools import ToolRegistry, register_system_tools

    spoken = []

    class IO:
        def say(self, t): spoken.append(t)
        def ask(self, q): return ""
        def confirm(self, summary, detail=""):
            spoken.append(summary)
            self.detail = detail
            return False

    io = IO()
    reg = ToolRegistry()
    register_system_tools(reg, Config(home=tmp_path), io)
    reg.execute("run_shell", {"command": "pkill -x 'Google Chrome'; sleep 2; open -a 'Google Chrome'", "reason": "Chrome restart"})
    assert spoken == ["Ye command chalaun? Chrome restart"]
    assert "pkill" in io.detail and "pkill" not in spoken[0]


def test_show_cards_tool_only_when_ui_supports_it(tmp_path):
    from karishma.config import Config
    from karishma.tools import ToolRegistry, register_system_tools

    class Plain:
        def say(self, t): pass
        def ask(self, q): return ""
        def confirm(self, s, detail=""): return False

    class WithCards(Plain):
        shown = None
        def show_cards(self, items): WithCards.shown = items

    reg = ToolRegistry(); register_system_tools(reg, Config(home=tmp_path), Plain())
    assert "show_cards" not in reg.names()
    reg = ToolRegistry(); register_system_tools(reg, Config(home=tmp_path), WithCards())
    out, err = reg.execute("show_cards", {"items": [{"title": "Satish Kumar | Motion Designer", "url": "https://satishkumar.net"}]})
    assert not err and WithCards.shown[0]["title"].startswith("Satish")
