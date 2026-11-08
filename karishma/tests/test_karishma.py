"""Tests that run anywhere (no API keys, no Mac needed). Run: python -m pytest -q"""

from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace as NS

import pytest

from karishma.brain import Brain
from karishma.config import Config
from karishma.main import build, contains_wake_word
from karishma.tools import Memory, ToolRegistry, register_memory_tools, register_system_tools
from karishma.tools.browser import MONEY_WORDS
from karishma.tools.system import BLOCKED, is_risky_applescript, is_safe_shell
from karishma.voice import clean_for_speech, is_yes, pcm_to_wav


class FakeIO:
    def __init__(self, answers=None, approve=True):
        self.said, self.asked, self.confirms = [], [], []
        self.answers = list(answers or [])
        self.approve = approve

    def say(self, text):
        self.said.append(text)

    def ask(self, q):
        self.asked.append(q)
        return self.answers.pop(0) if self.answers else "ho gaya"

    def confirm(self, summary, detail=""):
        self.confirms.append(summary)
        return self.approve


@pytest.fixture
def cfg(tmp_path):
    exe = os.environ.get("KARISHMA_BROWSER_EXECUTABLE")
    if not exe:
        for cand in Path("/opt/pw-browsers").glob("chromium-*/chrome-linux64/chrome"):
            exe = str(cand)
    return Config(anthropic_api_key="test", home=tmp_path, browser_headless=True, browser_executable=exe)


# ---------------- safety rules ----------------
@pytest.mark.parametrize("cmd", ["ls -la ~/Downloads", "df -h", "pmset -g batt", "date", "sw_vers"])
def test_safe_shell(cmd):
    assert is_safe_shell(cmd)


@pytest.mark.parametrize("cmd", ["rm file.txt", "ls; rm -rf ~", "curl -d x=1 http://a", "defaults write x y 1",
                                 "find . -delete", "echo hi > a.txt", "sudo shutdown -h now", "osascript -e 'x'"])
def test_unsafe_shell_needs_confirmation(cmd):
    assert not is_safe_shell(cmd)


@pytest.mark.parametrize("cmd", ["rm -rf /", "rm -rf ~", "sudo rm -rf / ", "diskutil eraseDisk JHFS+ x disk0", ":(){ :|:& };:"])
def test_blocked(cmd):
    assert BLOCKED.search(cmd)


def test_applescript_risk():
    assert not is_risky_applescript("set volume output volume 40")
    assert is_risky_applescript('tell application "Messages" to send "hi" to buddy "Ma"')
    assert is_risky_applescript('tell application "Finder" to empty trash')


def test_money_words():
    for t in ["Proceed to Pay", "Place Order", "BOOK NOW", "Make Payment", "Confirm Booking", "Buy Now"]:
        assert MONEY_WORDS.search(t), t
    for t in ["Search Flights", "Login", "Add to cart", "Next"]:
        assert not MONEY_WORDS.search(t), t


# ---------------- voice helpers ----------------
@pytest.mark.parametrize("ans,expected", [
    ("haan kar do", True), ("Yes please", True), ("theek hai", True), ("हाँ", True), ("ji bilkul", True),
    ("nahi", False), ("no", False), ("mat karo", False), ("ruko", False), ("", False), ("kya?", False),
    ("haan kar do na", True),
])
def test_is_yes(ans, expected):
    assert is_yes(ans) is expected


def test_clean_for_speech():
    s = clean_for_speech("**Flight** mil gayi: [IndiGo](https://x.com) ₹4,250\n- 6 AM\n```code```")
    assert "**" not in s and "https" not in s and "code" not in s and "IndiGo" in s


def test_pcm_to_wav():
    assert pcm_to_wav(b"\x00\x00" * 160)[:4] == b"RIFF"


def test_wake_word(cfg):
    assert contains_wake_word("Karishma, Delhi ka weather batao", cfg) == "Delhi ka weather batao"
    assert contains_wake_word("karishma", cfg) == ""
    assert contains_wake_word("aaj kya khana hai", cfg) is None
    assert contains_wake_word("करिश्मा गाना चलाओ", cfg) == "गाना चलाओ"


# ---------------- tools ----------------
def test_registry_validation(cfg):
    reg = ToolRegistry()
    register_memory_tools(reg, Memory(cfg.memory_file))
    out, err = reg.execute("remember", {})
    assert err and "Missing" in out
    out, err = reg.execute("nope", {})
    assert err
    out, err = reg.execute("remember", {"fact": "Ghar Jaipur me hai", "extra": 1})
    assert not err and out == "saved"
    assert "Jaipur" in reg.execute("recall", {})[0]
    assert Memory(cfg.memory_file).facts[0]["fact"] == "Ghar Jaipur me hai"  # persisted
    assert reg.execute("forget", {"text": "jaipur"})[0] == "removed 1 fact(s)"


def test_shell_tool_runs_safe_and_asks_for_risky(cfg, tmp_path):
    io = FakeIO(approve=False)
    reg = ToolRegistry()
    register_system_tools(reg, cfg, io)
    out, err = reg.execute("run_shell", {"command": "echo namaste"})
    assert not err and "namaste" in out and not io.confirms
    target = tmp_path / "x.txt"
    target.write_text("hi")
    out, err = reg.execute("run_shell", {"command": f"rm {target}", "reason": "cleanup"})
    assert "declined" in out.lower() and target.exists() and io.confirms
    out, err = reg.execute("run_shell", {"command": "rm -rf /"})
    assert err and "Blocked" in out


def test_confirm_tool(cfg):
    io = FakeIO(approve=True)
    reg = ToolRegistry()
    register_system_tools(reg, cfg, io)
    assert reg.execute("confirm_with_user", {"summary": "Book 2 tickets ₹900"})[0].startswith("APPROVED")


# ---------------- brain loop with a fake Claude ----------------
class FakeClient:
    """Plays back scripted responses and records the requests."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.requests.append({**kw, "messages": list(kw["messages"])})
        return self.responses.pop(0)


def text(t):
    return NS(type="text", text=t)


def tool_use(id_, name, inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


def test_brain_tool_loop(cfg):
    io = FakeIO()
    client = FakeClient([
        NS(stop_reason="tool_use", content=[text("Yaad kar leti hoon."), tool_use("t1", "remember", {"fact": "Naam Satish"})]),
        NS(stop_reason="end_turn", content=[text("Ji Satish ji, yaad rakh liya!")]),
    ])
    brain, browser = build(cfg, io, client=client)
    reply = brain.handle("Mera naam Satish hai, yaad rakhna")
    assert reply == "Ji Satish ji, yaad rakh liya!"
    req = client.requests[0]
    assert req["model"] == "claude-opus-5-5"
    assert req["thinking"] == {"type": "adaptive"}
    assert "fallbacks" in req and "server-side-fallback-2026-07-01" in req["betas"]
    names = {t["name"] for t in req["tools"]}
    assert {"web_search", "web_fetch", "browser", "run_applescript", "confirm_with_user", "remember"} <= names
    # tool result went back with matching id
    last_user = client.requests[1]["messages"][-1]
    assert last_user["content"][0]["tool_use_id"] == "t1"
    assert "Satish" in Memory(cfg.memory_file).as_text()
    browser.close()


def test_brain_retries_without_fallbacks(cfg):
    import anthropic
    import httpx

    calls = []

    def create(**kw):
        calls.append(kw)
        if "fallbacks" in kw:
            req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
            raise anthropic.BadRequestError("fallbacks not supported", response=httpx.Response(400, request=req), body=None)
        return NS(stop_reason="end_turn", content=[text("OK")])

    client = NS(beta=NS(messages=NS(create=create)))
    brain, browser = build(cfg, FakeIO(), client=client)
    assert brain.handle("hi") == "OK"
    assert "fallbacks" not in calls[-1]
    browser.close()


def test_brain_refusal_and_pause(cfg):
    client = FakeClient([
        NS(stop_reason="pause_turn", content=[NS(type="server_tool_use", id="s1", name="web_search", input={})]),
        NS(stop_reason="refusal", content=[]),
    ])
    brain, browser = build(cfg, FakeIO(), client=client)
    assert "madad nahi" in brain.handle("something")
    assert len(client.requests) == 2
    browser.close()


# ---------------- browser (real Chromium, local page) ----------------
SHOP = """<html><body><h1>Train Search</h1>
<input name="from" placeholder="From station"><input name="to" placeholder="To station">
<button onclick="document.getElementById('r').innerText='Rajdhani 12951 - Rs 2,450'">Search Trains</button>
<div id="r"></div>
<input type="password" placeholder="Password">
<button onclick="document.getElementById('r').innerText='PAID'">Proceed to Pay</button>
</body></html>"""


def test_browser_flow(cfg, tmp_path):
    if not cfg.browser_executable:
        pytest.skip("no chromium available")
    page = tmp_path / "shop.html"
    page.write_text(SHOP)
    io = FakeIO(approve=False)
    reg = ToolRegistry()
    from karishma.tools import register_browser_tools

    br = register_browser_tools(reg, cfg, io)
    try:
        out, err = reg.execute("browser", {"action": "open", "url": page.as_uri()})
        assert not err, out
        assert "Train Search" in out

        def eid(label):
            for line in br.snapshot().splitlines():
                if label in line and line.startswith("["):
                    return int(line[1:line.index("]")])
            raise AssertionError(label)

        reg.execute("browser", {"action": "type", "element_id": eid("From station"), "text": "NDLS"})
        reg.execute("browser", {"action": "type", "element_id": eid("To station"), "text": "BCT"})
        out, err = reg.execute("browser", {"action": "click", "element_id": eid("Search Trains")})
        assert "Rajdhani 12951" in out
        # password field is refused
        out, err = reg.execute("browser", {"action": "type", "element_id": eid("Password"), "text": "x"})
        assert err and "password" in out.lower()
        # pay button requires confirmation - user says no
        out, err = reg.execute("browser", {"action": "click", "element_id": eid("Proceed to Pay")})
        assert "DECLINED" in out and io.confirms
        assert "PAID" not in br.snapshot()
        # user says yes
        io.approve = True
        out, err = reg.execute("browser", {"action": "click", "element_id": eid("Proceed to Pay")})
        assert "PAID" in out
        shot, err = reg.execute("browser", {"action": "screenshot"})
        assert not err and shot[1]["type"] == "image"
    finally:
        br.close()
