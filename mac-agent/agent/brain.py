"""The thinking part: sends the conversation to Claude and runs the tools it asks for."""

import datetime as dt

import anthropic

from .config import WORKSPACE
from .tools import TOOL_DEFINITIONS

MAX_STEPS = 40          # tool-call rounds per request
MAX_HISTORY = 60        # messages kept between requests
FALLBACK_MODELS = {"claude-opus-5", "claude-fable-5-1"}

SERVER_TOOLS = [
    {
        "type": "web_search_20260209",
        "name": "web_search",
        "max_uses": 10,
        "user_location": {"type": "approximate", "country": "IN", "timezone": "Asia/Kolkata"},
    },
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 10},
]

SYSTEM_PROMPT = """You are {agent_name}, a friendly, smart personal AI agent living on {user_name}'s MacBook. \
{user_name} talks to you by voice (speech-to-text, so expect small recognition mistakes) or by typing, \
and you act on the Mac with your tools.

How to talk:
- Speak Hinglish (Hindi in Roman script mixed with English) unless {user_name} uses pure English or asks otherwise. \
You are {agent_name}; use a warm, natural tone.
- Your reply is read aloud, so keep it short: usually 1-3 sentences. No markdown tables, no long lists, no URLs read out. \
Put long content (research, reports, scripts) in a file with write_file and just tell the key points.
- For tasks with several steps, call update_user once or twice with a one-line progress update so {user_name} \
knows what is happening. Don't narrate every tool call.

How to work:
- Just do what is asked with your tools; don't ask permission for harmless actions (opening apps, searching, \
reading, creating new files, making posters, editing copies of videos).
- Ask first (and only then pass confirmed=true) before anything that deletes, overwrites, moves, sends messages/emails, \
spends money, or changes system settings. If a tool answers NEEDS_CONFIRMATION, explain and ask.
- Research: use web_search / web_fetch, check several sources, then save a clear Markdown report in \
{workspace}/research/ (open_after=true) and speak a 2-3 line summary.
- Posters/graphics: use create_poster with polished, modern HTML/CSS design.
- Video editing: use media_info first, then run_ffmpeg. Never overwrite the original file. Save to {workspace}/videos/.
- Opening things: open_app for apps, open_url / browser_search to show websites in Chrome.
- If {user_name} asks you to change your name, wake word, voice or speaking speed, use change_identity.
- If {user_name} says bye / bas / so jao / that's all, reply briefly and call go_to_sleep.
- If something fails, try another way before giving up, then say plainly what went wrong.
- Files you create go to {workspace} unless told otherwise. The home folder is ~.
"""


class Brain:
    def __init__(self, agent):
        self.agent = agent
        self.config = agent.config
        self.messages = []
        self.cancelled = False

    def reset(self):
        self.messages = []

    def _client(self):
        key = self.config.api_key()
        if not key:
            raise RuntimeError("NO_KEY")
        return anthropic.Anthropic(api_key=key, max_retries=3)

    def _system(self):
        return SYSTEM_PROMPT.format(
            agent_name=self.config["agent_name"],
            user_name=self.config["user_name"],
            workspace=str(WORKSPACE),
        )

    def _trim_history(self):
        if len(self.messages) <= MAX_HISTORY:
            return
        # Cut at the start of a real user turn so tool_use/tool_result pairs stay together.
        cut = len(self.messages) - MAX_HISTORY
        while cut < len(self.messages):
            msg = self.messages[cut]
            if msg["role"] == "user" and isinstance(msg["content"], str):
                break
            cut += 1
        self.messages = self.messages[cut:]

    def ask(self, text, on_event):
        """Handle one request. on_event(kind, text) streams progress to the UI.

        Returns the final reply text to speak.
        """
        self.cancelled = False
        try:
            client = self._client()
        except RuntimeError:
            return ("Mujhe abhi Claude API key nahi mili. Settings (⚙️) me apni API key daal dijiye, "
                    "phir main sab kaam kar dungi.")

        self._trim_history()
        turn_start = len(self.messages)
        now = dt.datetime.now().strftime("%A, %d %B %Y, %I:%M %p")
        self.messages.append({"role": "user", "content": f"[{now}] {text}"})
        toolbox = self.agent.toolbox

        for _ in range(MAX_STEPS):
            if self.cancelled:
                self._close_open_tool_calls()
                return "Theek hai, maine kaam rok diya."
            model = self.config["model"]
            # Server-side refusal fallbacks are available on these models.
            fallback = (
                {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
                if model in FALLBACK_MODELS else {}
            )
            try:
                response = client.beta.messages.create(
                    model=model,
                    max_tokens=16000,
                    system=self._system(),
                    tools=[*TOOL_DEFINITIONS, *SERVER_TOOLS],
                    messages=self.messages,
                    thinking={"type": "adaptive"},
                    output_config={"effort": self.config["effort"]},
                    cache_control={"type": "ephemeral"},
                    **fallback,
                )
            except anthropic.AuthenticationError:
                del self.messages[turn_start:]
                return "Claude API key sahi nahi lag rahi. Settings me dobara check kar lijiye."
            except anthropic.PermissionDeniedError as exc:
                del self.messages[turn_start:]
                return f"Claude API ne permission nahi di: {exc.message}"
            except anthropic.RateLimitError:
                del self.messages[turn_start:]
                return "Abhi Claude API ki limit hit ho gayi hai, thodi der baad try karte hain."
            except anthropic.APIConnectionError:
                del self.messages[turn_start:]
                return "Internet connection me problem lag rahi hai, main Claude tak nahi pahunch paa rahi."
            except anthropic.APIStatusError as exc:
                del self.messages[turn_start:]
                return f"Claude API error aaya ({exc.status_code}): {exc.message}"

            if response.stop_reason == "refusal":
                del self.messages[turn_start:]
                return "Sorry, ye request main poori nahi kar sakti."

            self.messages.append({"role": "assistant", "content": response.content})
            texts = [b.text for b in response.content if b.type == "text" and b.text.strip()]

            if response.stop_reason == "pause_turn":
                continue  # long server-side search; resend to let Claude continue

            tool_calls = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason == "tool_use" and tool_calls:
                if texts:
                    on_event("progress", " ".join(texts))
                results = []
                for call in tool_calls:
                    on_event("tool", toolbox.describe(call.name, call.input))
                    output, is_error = toolbox.run(call.name, dict(call.input or {}))
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": output if isinstance(output, list) else str(output),
                        "is_error": is_error,
                    })
                self.messages.append({"role": "user", "content": results})
                continue

            for block in response.content:
                if block.type == "server_tool_use":
                    on_event("tool", toolbox.describe(block.name, {}))
            reply = "\n".join(texts).strip()
            if response.stop_reason == "max_tokens":
                reply += "\n(Jawab lamba tha, beech me kat gaya.)"
            return reply or "Ho gaya."

        return "Ye kaam bahut lamba ho gaya, maine yahin rok diya. Bataiye aage kya karun?"

    def _close_open_tool_calls(self):
        """After a cancel, keep history valid: every tool_use needs a tool_result."""
        if not self.messages or self.messages[-1]["role"] != "assistant":
            return
        pending = [b for b in self.messages[-1]["content"] if getattr(b, "type", None) == "tool_use"]
        if pending:
            self.messages.append({
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": b.id, "content": "Cancelled by user.", "is_error": True}
                    for b in pending
                ],
            })
