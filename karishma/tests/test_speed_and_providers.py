"""Fast path, brain switching (other providers), and sentence-pipelined speech."""

from __future__ import annotations

import json
import threading
import time
from types import SimpleNamespace as NS

import pytest

from karishma import fastpath
from karishma.brain import Brain, SwitchingBrain, make_brain
from karishma.brain_openai import BrainUnavailable, OpenAICompatBrain, provider_settings
from karishma.config import Config
from karishma.tools import Memory, ToolRegistry, register_memory_tools
from karishma.voice import Mouth, split_for_speech


@pytest.fixture
def cfg(tmp_path):
    return Config(anthropic_api_key="t", home=tmp_path)


# ---------------- fast path ----------------
@pytest.mark.parametrize("text,cmd,reply", [
    ("YouTube kholo", ["open", "https://www.youtube.com"], "Youtube khol diya."),
    ("chrome open karo", ["open", "-a", "Google Chrome"], "Chrome khol diya."),
    ("open spotify", ["open", "-a", "Spotify"], "Spotify khol diya."),
    ("volume 30 kar do", ["osascript", "-e", "set volume output volume 30"], "Volume 30 kar diya."),
    ("mute karo", ["osascript", "-e", "set volume output muted true"], "Mute kar diya."),
])
def test_fastpath_instant(text, cmd, reply):
    ran = []
    assert fastpath.handle(text, run=ran.append) == reply
    assert ran == [cmd]


@pytest.mark.parametrize("text", ["kal Delhi ki flight dhundo", "Satish Kumar kaun hai",
                                  "mera resume wala folder kholo", "irctc par 2 tickets book karo Mumbai ke liye"])
def test_fastpath_leaves_real_work_to_brain(text):
    ran = []
    assert fastpath.handle(text, run=ran.append) is None and ran == []


def test_fastpath_time_and_date():
    assert fastpath.handle("time kya hua", run=lambda a: None).startswith("Abhi ")
    assert fastpath.handle("aaj ki date batao", run=lambda a: None).startswith("Aaj ")


# ---------------- provider settings ----------------
def test_provider_settings_presets_and_overrides():
    env = {"GEMINI_API_KEY": "g", "KARISHMA_GEMINI_MODEL": "gemini-x"}.get
    base, key, model = provider_settings("gemini", env)
    assert "generativelanguage.googleapis.com" in base and key == "g" and model == "gemini-x"
    base, key, model = provider_settings("ollama", {}.get)
    assert base.startswith("http://localhost") and key == "ollama"
    env = {"KARISHMA_CUSTOM_BASE_URL": "https://my.ai/v1", "KARISHMA_CUSTOM_API_KEY": "k",
           "KARISHMA_CUSTOM_MODEL": "m1"}.get
    assert provider_settings("custom", env) == ("https://my.ai/v1", "k", "m1")


def test_missing_key_is_unavailable(cfg):
    with pytest.raises(BrainUnavailable):
        OpenAICompatBrain(cfg, ToolRegistry(), "sys", "openai", {}.get)


# ---------------- OpenAI-compatible brain loop with a fake client ----------------
def _call(id_, name, args):
    return NS(id=id_, function=NS(name=name, arguments=args))


def _resp(content=None, calls=None):
    return NS(choices=[NS(message=NS(content=content, tool_calls=calls))])


class FakeOpenAI:
    def __init__(self, responses):
        self.responses, self.requests = list(responses), []
        self.chat = NS(completions=NS(create=self._create))

    def _create(self, **kw):
        self.requests.append(json.loads(json.dumps(kw, default=str)))
        return self.responses.pop(0)


def test_openai_brain_runs_tools(cfg):
    reg = ToolRegistry()
    register_memory_tools(reg, Memory(cfg.memory_file))
    client = FakeOpenAI([
        _resp("Yaad kar rahi hoon", [_call("c1", "remember", '{"fact": "Ghar Jaipur"}'), _call("c2", "recall", "{bad")]),
        _resp("Yaad rakh liya!"),
    ])
    b = OpenAICompatBrain(cfg, reg, "SYSTEM", "gemini", {}.get, client=client)
    assert b.handle("ghar Jaipur me hai yaad rakho") == "Yaad rakh liya!"
    req1, req2 = client.requests
    assert req1["messages"][0] == {"role": "system", "content": "SYSTEM"}
    names = {t["function"]["name"] for t in req1["tools"]}
    assert {"remember", "web_search", "web_fetch"} <= names       # free web tools added for non-Claude brains
    tool_msgs = [m for m in req2["messages"] if m["role"] == "tool"]
    assert tool_msgs[0]["tool_call_id"] == "c1" and tool_msgs[0]["content"] == "saved"
    assert "Invalid JSON" in tool_msgs[1]["content"]
    assert "Jaipur" in Memory(cfg.memory_file).as_text()


def test_openai_brain_sends_screenshots_as_images(cfg):
    reg = ToolRegistry()
    reg.add("shot", "s", {})(lambda: [{"type": "text", "text": "screen"},
                                      {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "AAA"}}])
    client = FakeOpenAI([_resp(None, [_call("c1", "shot", "{}")]), _resp("Screen par Chrome khula hai.")])
    b = OpenAICompatBrain(cfg, reg, "S", "openai", {}.get, client=client)
    assert b.handle("screen dekho") == "Screen par Chrome khula hai."
    last = client.requests[1]["messages"][-1]
    assert last["role"] == "user" and last["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,AAA")


# ---------------- automatic switch when Claude credits run out ----------------
def test_switches_to_backup_when_claude_credits_end(cfg):
    import anthropic
    import httpx

    def create(**kw):
        req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
        raise anthropic.BadRequestError("Your credit balance is too low to access the Anthropic API.",
                                        response=httpx.Response(400, request=req), body=None)

    reg = ToolRegistry()
    claude = Brain(cfg, reg, lambda: "", client=NS(beta=NS(messages=NS(create=create))))
    backup = OpenAICompatBrain(cfg, reg, "S", "groq", {}.get, client=FakeOpenAI([_resp("Mausam saaf hai."),
                                                                                  _resp("Doosra jawab.")]))
    sb = SwitchingBrain([("claude", lambda: claude), ("groq", lambda: backup)])
    first = sb.handle("mausam?")
    assert "credits khatam" in first and "Groq" in first and first.endswith("Mausam saaf hai.")
    assert sb.handle("aur?") == "Doosra jawab."          # stays on the backup, no repeated notice
    assert sb.name == "groq"


def test_no_backup_gives_clear_message(cfg):
    def make():
        raise BrainUnavailable("Claude API key nahi hai")
    sb = SwitchingBrain([("claude", make)])
    msg = sb.handle("hi")
    assert "Claude API key nahi hai" in msg and "KARISHMA_BACKUP_BRAIN" in msg


def test_make_brain_order_and_cancel_shared(cfg, monkeypatch):
    cfg.brain_provider, cfg.backup_brains = "gemini", ("claude",)
    sb = make_brain(cfg, ToolRegistry(), lambda: "", env={"GEMINI_API_KEY": "g"}.get)
    assert [n for n, _ in sb.makers] == ["gemini", "claude"]
    monkeypatch.setattr("openai.OpenAI", lambda **kw: FakeOpenAI([_resp("ok")]))
    assert sb.handle("hi") == "ok"
    assert sb.current.cancel is sb.cancel


def test_claude_tool_list_has_no_duplicate_web_tools(cfg):
    from karishma.brain_openai import add_web_tools

    reg = ToolRegistry()
    add_web_tools(reg)
    b = Brain(cfg, reg, lambda: "", client=NS())
    names = [t["name"] for t in b._tool_list()]
    assert names.count("web_search") == 1 and names.count("web_fetch") == 1


def test_web_search_parser(monkeypatch):
    import httpx

    html = ('<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsatishkumar.net%2F&rut=x">'
            'Satish Kumar | Motion Designer</a><a class="result__snippet" href="#">Creative <b>motion</b> designer</a>')
    monkeypatch.setattr(httpx, "post", lambda *a, **k: NS(text=html, raise_for_status=lambda: None))
    from karishma.brain_openai import web_search

    out = web_search("satish kumar")
    assert "Satish Kumar | Motion Designer" in out and "https://satishkumar.net/" in out and "motion designer" in out


# ---------------- speech pipelining ----------------
def test_split_for_speech():
    parts = split_for_speech("Pehla vaakya chhota hai. " + "Doosra thoda lamba vaakya hai. " * 8)
    assert len(parts[0]) <= 90 and len(parts) >= 2
    assert split_for_speech("Ho gaya.") == ["Ho gaya."]


def test_mouth_generates_next_part_while_playing(cfg):
    m = Mouth(Config(home=cfg.home))
    m._client, m.cfg.elevenlabs_voice_id = object(), "v"
    log = []

    def tts(text):
        log.append(("tts_start", text[:5], time.time())); time.sleep(0.3)
        return text.encode()

    def play(audio):
        log.append(("play", audio[:5].decode(), time.time())); time.sleep(0.4)

    m._tts, m._play_mp3 = tts, play
    t0 = time.time()
    m.speak("Pehla. " + "Doosra vaakya bahut lamba hai aur aage bhi chalta hai. " * 3 + "Teesra.")
    total = time.time() - t0
    plays = [e for e in log if e[0] == "play"]
    assert len(plays) >= 2
    # part 2 was generated during part 1's playback -> total < sum of all tts+play times
    assert total < len(plays) * 0.7 - 0.1


def test_mouth_stop_skips_remaining_parts(cfg):
    m = Mouth(Config(home=cfg.home))
    m._client, m.cfg.elevenlabs_voice_id = object(), "v"
    played = []
    m._tts = lambda text: text.encode()

    def play(audio):
        played.append(audio)
        m.stop()  # user interrupts during the first part

    m._play_mp3 = play
    m.speak("Ek. " + "Do bahut lamba vaakya. " * 10)
    assert len(played) == 1


def test_model_gone_picks_available_one(cfg):
    import httpx
    import openai

    calls = []

    def create(**kw):
        calls.append(kw["model"])
        if kw["model"] == "llama-3.3-70b-versatile":
            req = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
            raise openai.NotFoundError("The model `llama-3.3-70b-versatile` does not exist",
                                       response=httpx.Response(404, request=req), body=None)
        return _resp("4 hota hai.")

    models = ["whisper-large-v3", "meta-llama/llama-guard-4-12b", "openai/gpt-oss-20b", "openai/gpt-oss-120b",
              "llama-3.1-8b-instant"]
    client = NS(chat=NS(completions=NS(create=create)),
                models=NS(list=lambda: [NS(id=m) for m in models]))
    b = OpenAICompatBrain(cfg, ToolRegistry(), "S", "groq", {"KARISHMA_GROQ_MODEL": "llama-3.3-70b-versatile"}.get,
                          client=client)
    assert b.handle("2+2?") == "4 hota hai."
    assert calls == ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]
    assert b.model == "openai/gpt-oss-120b"


def test_pick_model_skips_non_chat():
    from karishma.brain_openai import pick_model

    assert pick_model("groq", ["whisper-large-v3", "llama-guard-x", "some-new-model"]) == "some-new-model"
    assert pick_model("gemini", ["models/gemini-2.5-flash", "models/embedding-001"]) == "models/gemini-2.5-flash"
    assert pick_model("groq", ["whisper-large-v3"]) is None
