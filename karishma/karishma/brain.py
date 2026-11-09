"""Karishma's brain: a Claude agent loop with tools."""

from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import Any, Callable

import anthropic

from .brain_openai import PROVIDERS, BrainUnavailable, OpenAICompatBrain
from .config import Config
from .tools.base import ToolRegistry

log = logging.getLogger("karishma.brain")

SYSTEM_PROMPT = """You are Karishma, a warm, smart female personal AI assistant living on {user}'s MacBook (Intel, 2019). \
You talk by VOICE, like Siri but far more capable, and you actually get things done.

How to talk
- Reply in the user's language: Hindi, Hinglish or English (default Hinglish, written in Roman/Latin script \
unless the user speaks pure Hindi - then Devanagari is fine). Address the user politely ("aap").
- Your replies are spoken aloud: keep them short and natural (1-3 sentences), no markdown, no bullet lists, \
no URLs read out, numbers spoken clearly (e.g. "4,250 rupaye"). Give detail only when asked for it.
- While working on a long task, you don't need to narrate every step.
- When the user asks about a person, company, website, place, product, news, or options to choose from \
(flights, hotels, restaurants, phones...), first call show_cards with 2-5 cards (title, 1-2 line summary, \
source, url) so it appears on screen like Siri, then speak just 1-2 sentences.
- Confirmations (confirm_with_user, ask_user) must be ONE short sentence. Never read out shell commands, \
scripts, URLs or long lists - put those in the 'detail' field instead.

What you can do (use the tools - don't just describe)
- Research anything: web_search / web_fetch, then give a crisp spoken answer.
- Control the Mac: run_applescript (volume, apps, music, reminders, calendar, notes, mail, messages, \
dark mode, notifications), run_shell (files, system info), open_item, screenshot_screen to see the screen.
- Book and order things in the browser tool: flights, trains (IRCTC), buses, movies, hotels, cabs, food, \
groceries, shopping. Prefer the user's usual sites: IRCTC, MakeMyTrip, Goibibo, Cleartrip, RedBus, \
BookMyShow, Amazon.in, Flipkart, Swiggy, Zomato, Blinkit, Zepto, Uber, Ola.
- Remember facts about the user with remember / recall.

Rules for money and irreversible actions (very important)
- Before any booking, order, purchase, payment, sending a message/email for the user, or deleting \
anything: call confirm_with_user with a short summary including price, date/time and recipient. \
Proceed only if APPROVED.
- Never type card numbers, CVV, OTP, UPI PIN or passwords. Fill everything else, then ask the user to \
complete login/captcha/OTP/payment in the browser window and use browser action wait_for_user.
- If details are missing (date, city, class, budget, quantity), ask with ask_user instead of guessing. \
If the user says "jaldi/cheapest/best", pick sensibly and say what you picked.
- If a site needs the user to log in, open it and ask them to log in once - the browser profile keeps them \
logged in afterwards.
- You can't make phone calls or access the user's phone. If something is impossible, say so briefly and \
offer the closest alternative.

User profile
- Name: {user}
- City: {city}
- Saved memory:
{memory}
"""


def system_prompt(cfg: Config, memory_text: Callable[[], str]) -> str:
    return SYSTEM_PROMPT.format(
        user=cfg.user_name or "the user",
        city=cfg.user_city or "unknown (ask if needed)",
        memory=memory_text(),
    )


def _credit_problem(e: Exception) -> bool:
    m = str(e).lower()
    return any(w in m for w in ("credit balance", "credits", "billing", "insufficient", "quota", "payment"))


class Brain:
    """Claude brain."""

    name = "Claude"

    def __init__(
        self,
        cfg: Config,
        tools: ToolRegistry,
        memory_text: Callable[[], str],
        client: Any | None = None,
        on_status: Callable[[str], None] | None = None,
    ) -> None:
        self.cfg = cfg
        self.tools = tools
        self.client = client or anthropic.Anthropic(api_key=cfg.anthropic_api_key, max_retries=3)
        self.on_status = on_status or (lambda s: None)
        self.system = system_prompt(cfg, memory_text)
        self.messages: list[dict[str, Any]] = []
        # Optional API features; switched off automatically if the API rejects them.
        self.use_fallbacks = True
        self.use_compaction = True
        self.max_steps = 40
        self.cancel = threading.Event()  # set by the UI when the user gives a new command

    # ------------------------------------------------------------------
    def reset(self) -> None:
        self.messages = []

    def _tool_list(self) -> list[dict[str, Any]]:
        location: dict[str, Any] = {"type": "approximate", "country": "IN", "timezone": "Asia/Kolkata"}
        if self.cfg.user_city:
            location["city"] = self.cfg.user_city
        own = [t for t in self.tools.schemas() if t["name"] not in ("web_search", "web_fetch")]  # Claude has server ones
        return own + [
            {"type": "web_search_20260209", "name": "web_search", "max_uses": 8, "user_location": location},
            {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 8},
        ]

    def _create(self):
        betas: list[str] = []
        kwargs: dict[str, Any] = dict(
            model=self.cfg.model,
            max_tokens=16000,
            system=[{"type": "text", "text": self.system, "cache_control": {"type": "ephemeral"}}],
            tools=self._tool_list(),
            messages=self.messages,
            thinking={"type": "adaptive"},
            output_config={"effort": self.cfg.effort},
            cache_control={"type": "ephemeral"},
        )
        if self.use_fallbacks:
            betas.append("server-side-fallback-2026-07-01")
            kwargs["fallbacks"] = "default"
        if self.use_compaction:
            betas.append("compact-2026-01-12")
            kwargs["context_management"] = {"edits": [{"type": "compact_20260112"}]}
        if betas:
            kwargs["betas"] = betas
        try:
            return self.client.beta.messages.create(**kwargs)
        except anthropic.AuthenticationError as e:
            raise BrainUnavailable("Claude API key galat hai") from e
        except anthropic.PermissionDeniedError as e:
            raise BrainUnavailable("Claude key ko permission nahi") from e
        except anthropic.BadRequestError as e:
            msg = str(e).lower()
            if _credit_problem(e):
                raise BrainUnavailable("Claude ke credits khatam") from e
            if self.use_fallbacks and "fallback" in msg:
                log.warning("fallbacks not accepted, disabling: %s", e)
                self.use_fallbacks = False
                return self._create()
            if self.use_compaction and ("compact" in msg or "context_management" in msg):
                log.warning("compaction not accepted, disabling: %s", e)
                self.use_compaction = False
                return self._create()
            raise

    def _close_open_turn(self) -> None:
        """History must end cleanly; the next user message simply follows (append-only)."""
        if self.messages and self.messages[-1]["role"] == "user" and isinstance(self.messages[-1]["content"], list):
            # last message is tool results - fine; add a short note so the model knows it was interrupted
            self.messages.append({"role": "user", "content": "(Pichhla kaam user ne beech me rok diya.)"})

    # ------------------------------------------------------------------
    def handle(self, user_text: str) -> str | None:
        """Process one user request end-to-end and return the text to speak.
        Returns None if cancelled (the user gave a newer command)."""
        stamp = datetime.now().strftime("%A, %d %B %Y, %I:%M %p")
        self.messages.append({"role": "user", "content": f"[{stamp}] {user_text}"})

        spoken: list[str] = []
        for step in range(self.max_steps):
            if self.cancel.is_set():
                self._close_open_turn()
                return None
            try:
                response = self._create()
            except BrainUnavailable:
                raise
            except anthropic.RateLimitError:
                return "Abhi bahut requests ho gayi hain, ek minute baad try kariye."
            except anthropic.AuthenticationError:
                return "Claude API key galat lag rahi hai. Please .env file me ANTHROPIC_API_KEY check kariye."
            except anthropic.APIConnectionError:
                return "Internet se connect nahi ho pa rahi. Network check kariye."
            except anthropic.APIStatusError as e:
                if e.status_code == 402 or _credit_problem(e):
                    raise BrainUnavailable("Claude ke credits khatam") from e
                log.exception("API error")
                return f"Kuch gadbad ho gayi, error {e.status_code}."

            # Keep the full content (thinking, compaction, server-tool blocks) - append-only history.
            self.messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "refusal":
                return "Sorry, main is request me madad nahi kar sakti."

            texts = [b.text for b in response.content if getattr(b, "type", "") == "text" and b.text.strip()]

            if response.stop_reason == "pause_turn":
                continue

            tool_uses = [b for b in response.content if getattr(b, "type", "") == "tool_use"]
            if response.stop_reason == "tool_use" and tool_uses:
                if texts:  # short progress line the model said before the tool call
                    self.on_status(" ".join(texts))
                results = []
                for tu in tool_uses:
                    if self.cancel.is_set():
                        results.append({"type": "tool_result", "tool_use_id": tu.id,
                                        "content": "Cancelled: the user gave a new command.", "is_error": True})
                        continue
                    self.on_status(f"[tool] {tu.name}")
                    content, is_error = self.tools.execute(tu.name, tu.input)
                    log.info("tool %s(%s) error=%s", tu.name, str(tu.input)[:300], is_error)
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": content if content else "(empty)",
                        **({"is_error": True} if is_error else {}),
                    })
                self.messages.append({"role": "user", "content": results})
                continue

            if response.stop_reason == "max_tokens":
                spoken.extend(texts)
                spoken.append("(Jawab lamba tha, beech me ruk gaya.)")
                break

            spoken.extend(texts)
            break
        else:
            spoken.append("Ye kaam bahut steps le raha hai, maine abhi ke liye rok diya. Aage karun?")

        return " ".join(spoken).strip() or "Ho gaya."


# ---------------------------------------------------------------------- choosing / switching brains
FRIENDLY = {"claude": "Claude", "openai": "OpenAI", "gemini": "Gemini", "groq": "Groq", "openrouter": "OpenRouter",
            "deepseek": "DeepSeek", "ollama": "Ollama", "custom": "custom API"}


class SwitchingBrain:
    """Uses the main brain; if it becomes unavailable (credits over / bad key) switches to the backup."""

    def __init__(self, makers: list[tuple[str, Callable[[], Any]]], on_status: Callable[[str], None] | None = None):
        self.makers = makers
        self.cancel = threading.Event()
        self._on_status = on_status or (lambda s: None)
        self.idx = 0
        self.current = None
        self.name = makers[0][0]

    @property
    def on_status(self):
        return self._on_status

    @on_status.setter
    def on_status(self, fn):
        self._on_status = fn
        if self.current is not None:
            self.current.on_status = fn

    def _get(self):
        while self.current is None:
            name, make = self.makers[self.idx]
            try:
                self.current = make()
                self.current.cancel = self.cancel
                self.current.on_status = self._on_status
                self.name = name
            except BrainUnavailable as e:
                log.warning("brain %s unavailable: %s", name, e)
                if self.idx + 1 >= len(self.makers):
                    raise
                self.idx += 1
        return self.current

    def reset(self) -> None:
        if self.current is not None:
            self.current.reset()

    def handle(self, text: str) -> str | None:
        notes = []
        while True:
            try:
                brain = self._get()
                reply = brain.handle(text)
                if reply is not None and notes:
                    reply = " ".join(notes) + " " + reply
                return reply
            except BrainUnavailable as e:
                log.warning("switching brain: %s", e)
                if self.idx + 1 >= len(self.makers):
                    return (f"{e}. Dusri API set nahi hai. Settings (.env) me KARISHMA_BRAIN ya "
                            f"KARISHMA_BACKUP_BRAIN me koi aur API daal dijiye.")
                self.idx += 1
                self.current = None
                nxt = FRIENDLY.get(self.makers[self.idx][0], self.makers[self.idx][0])
                notes.append(f"{e}, isliye ab main {nxt} se kaam kar rahi hoon.")


def make_brain(cfg: Config, tools: ToolRegistry, memory_text: Callable[[], str],
               on_status: Callable[[str], None] | None = None, env=None) -> SwitchingBrain:
    import os

    env = env or os.environ.get
    order = [cfg.brain_provider] + [b for b in cfg.backup_brains if b != cfg.brain_provider]

    def maker(name: str):
        if name == "claude":
            def make():
                if not cfg.anthropic_api_key:
                    raise BrainUnavailable("Claude API key nahi hai")
                return Brain(cfg, tools, memory_text, on_status=on_status)
            return make
        if name not in PROVIDERS:
            raise ValueError(f"Unknown brain '{name}'. Use one of: claude, {', '.join(PROVIDERS)}")

        def make():
            return OpenAICompatBrain(cfg, tools, system_prompt(cfg, memory_text), name, env, on_status=on_status)
        return make

    return SwitchingBrain([(n, maker(n)) for n in order], on_status=on_status)
