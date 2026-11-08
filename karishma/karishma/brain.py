"""Karishma's brain: a Claude agent loop with tools."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Callable

import anthropic

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


class Brain:
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
        self.system = SYSTEM_PROMPT.format(
            user=cfg.user_name or "the user",
            city=cfg.user_city or "unknown (ask if needed)",
            memory=memory_text(),
        )
        self.messages: list[dict[str, Any]] = []
        # Optional API features; switched off automatically if the API rejects them.
        self.use_fallbacks = True
        self.use_compaction = True
        self.max_steps = 40

    # ------------------------------------------------------------------
    def reset(self) -> None:
        self.messages = []

    def _tool_list(self) -> list[dict[str, Any]]:
        location: dict[str, Any] = {"type": "approximate", "country": "IN", "timezone": "Asia/Kolkata"}
        if self.cfg.user_city:
            location["city"] = self.cfg.user_city
        return self.tools.schemas() + [
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
        except anthropic.BadRequestError as e:
            msg = str(e).lower()
            if self.use_fallbacks and "fallback" in msg:
                log.warning("fallbacks not accepted, disabling: %s", e)
                self.use_fallbacks = False
                return self._create()
            if self.use_compaction and ("compact" in msg or "context_management" in msg):
                log.warning("compaction not accepted, disabling: %s", e)
                self.use_compaction = False
                return self._create()
            raise

    # ------------------------------------------------------------------
    def handle(self, user_text: str) -> str:
        """Process one user request end-to-end and return the text to speak."""
        stamp = datetime.now().strftime("%A, %d %B %Y, %I:%M %p")
        self.messages.append({"role": "user", "content": f"[{stamp}] {user_text}"})

        spoken: list[str] = []
        for step in range(self.max_steps):
            try:
                response = self._create()
            except anthropic.RateLimitError:
                return "Abhi bahut requests ho gayi hain, ek minute baad try kariye."
            except anthropic.AuthenticationError:
                return "Claude API key galat lag rahi hai. Please .env file me ANTHROPIC_API_KEY check kariye."
            except anthropic.APIConnectionError:
                return "Internet se connect nahi ho pa rahi. Network check kariye."
            except anthropic.APIStatusError as e:
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
