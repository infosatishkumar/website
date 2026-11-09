"""Brain for any OpenAI-compatible API: OpenAI, Google Gemini, Groq, OpenRouter, DeepSeek, Ollama, …

Lets Karishma keep working when Claude credits run out - just change KARISHMA_BRAIN in .env
(or set KARISHMA_BACKUP_BRAIN to switch automatically).
"""

from __future__ import annotations

import html
import json
import logging
import re
import threading
from datetime import datetime
from typing import Any, Callable

from .config import Config
from .tools.base import ToolRegistry

log = logging.getLogger("karishma.brain_openai")

# name: (base_url, api-key env var, default model, key needed?)
PROVIDERS: dict[str, tuple[str, str, str, bool]] = {
    "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY", "gpt-4.1-mini", True),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY", "gemini-2.5-flash", True),
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY", "openai/gpt-oss-120b", True),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "openai/gpt-4.1-mini", True),
    "deepseek": ("https://api.deepseek.com/v1", "DEEPSEEK_API_KEY", "deepseek-chat", True),
    "ollama": ("http://localhost:11434/v1", "OLLAMA_API_KEY", "llama3.1", False),
    "custom": ("", "KARISHMA_CUSTOM_API_KEY", "", True),
}


# When the configured model no longer exists, pick the first available model containing one of these.
MODEL_PREFERENCE: dict[str, list[str]] = {
    "groq": ["gpt-oss-120b", "llama-4-maverick", "kimi-k2", "llama-4-scout", "qwen3", "llama-3.3", "gpt-oss-20b", "llama"],
    "openai": ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"],
    "gemini": ["gemini-3-flash", "gemini-2.5-flash", "gemini-flash", "gemini-3-pro", "gemini-2.5-pro", "gemini"],
    "openrouter": ["openai/gpt-5-mini", "openai/gpt-4.1-mini", "google/gemini-2.5-flash", "anthropic/claude"],
    "deepseek": ["deepseek-chat", "deepseek"],
    "ollama": ["llama3.1", "qwen", "llama", "mistral"],
}
NOT_CHAT = ("whisper", "tts", "embed", "guard", "moderation", "audio", "image", "dall", "transcribe", "realtime",
            "search-preview", "distil", "vision-preview", "orpheus", "playai", "compound")


def pick_model(provider: str, available: list[str]) -> str | None:
    """Best chat model from the provider's live model list."""
    chat = [m for m in available if not any(x in m.lower() for x in NOT_CHAT)]
    for pref in MODEL_PREFERENCE.get(provider, []):
        for m in sorted(chat, key=len):
            if pref in m.lower():
                return m
    return chat[0] if chat else None


class BrainUnavailable(Exception):
    """The provider can't be used right now (no credits / bad key / quota). Triggers the backup brain."""


def provider_settings(name: str, env: Callable[[str], str | None]) -> tuple[str, str | None, str]:
    """(base_url, api_key, model) for a provider, with .env overrides."""
    base, key_var, model, _ = PROVIDERS[name]
    up = name.upper()
    base = env(f"KARISHMA_{up}_BASE_URL") or (env("KARISHMA_CUSTOM_BASE_URL") if name == "custom" else None) or base
    model = env(f"KARISHMA_{up}_MODEL") or (env("KARISHMA_CUSTOM_MODEL") if name == "custom" else None) or model
    key = env(key_var) or ("ollama" if name == "ollama" else None)
    return base, key, model


# ------------------------------------------------------------------ web tools for non-Claude brains
def web_search(query: str, max_results: int = 6) -> str:
    """Free web search (DuckDuckGo HTML results) - no API key needed."""
    import httpx

    r = httpx.post("https://html.duckduckgo.com/html/", data={"q": query, "kl": "in-en"},
                   headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}, timeout=15,
                   follow_redirects=True)
    r.raise_for_status()
    out = []
    blocks = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a[^>]+class="result__a"|$)',
                        r.text, re.S)
    for href, title, rest in blocks[:max_results]:
        m = re.search(r"uddg=([^&]+)", href)
        if m:
            from urllib.parse import unquote

            href = unquote(m.group(1))
        snip = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', rest, re.S)
        clean = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()  # noqa: E731
        out.append(f"- {clean(title)}\n  {href}\n  {clean(snip.group(1) if snip else '')}")
    return "\n".join(out) or "No results."


def web_fetch(url: str, max_chars: int = 8000) -> str:
    import httpx

    r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}, timeout=20,
                  follow_redirects=True)
    r.raise_for_status()
    text = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", r.text)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()[:max_chars]


def add_web_tools(reg: ToolRegistry) -> None:
    @reg.add("web_search", "Search the internet (news, facts, prices, people, places). Returns titles, links, snippets.",
             {"query": {"type": "string"}}, ["query"])
    def _ws(query: str) -> str:
        return web_search(query)

    @reg.add("web_fetch", "Read the text of a web page (use a URL from web_search).",
             {"url": {"type": "string"}}, ["url"])
    def _wf(url: str) -> str:
        return web_fetch(url)


# ------------------------------------------------------------------ the brain
class OpenAICompatBrain:
    def __init__(self, cfg: Config, tools: ToolRegistry, system: str, provider: str,
                 env: Callable[[str], str | None], client: Any | None = None,
                 on_status: Callable[[str], None] | None = None) -> None:
        self.cfg = cfg
        self.provider = provider
        base, key, self.model = provider_settings(provider, env)
        if client is None:
            if not key:
                raise BrainUnavailable(f"{provider}: API key missing ({PROVIDERS[provider][1]})")
            if not base or not self.model:
                raise BrainUnavailable(f"{provider}: base URL / model missing in .env")
            import openai

            client = openai.OpenAI(api_key=key, base_url=base, max_retries=2, timeout=60)
        self.client = client
        self.tools = tools
        if "web_search" not in tools.names():
            add_web_tools(tools)
        self.system = system
        self.on_status = on_status or (lambda s: None)
        self.messages: list[dict[str, Any]] = []
        self.cancel = threading.Event()
        self.max_steps = 25
        self.images_ok = True

    def reset(self) -> None:
        self.messages = []

    def _tool_list(self) -> list[dict[str, Any]]:
        return [{"type": "function", "function": {"name": t["name"], "description": t["description"],
                                                  "parameters": t["input_schema"]}} for t in self.tools.schemas()]

    def _create(self):
        import openai

        msgs = [{"role": "system", "content": self.system}] + self.messages
        try:
            return self.client.chat.completions.create(model=self.model, messages=msgs, tools=self._tool_list(),
                                                       max_tokens=4000)
        except openai.AuthenticationError as e:
            raise BrainUnavailable(f"{self.provider}: API key galat hai") from e
        except openai.PermissionDeniedError as e:
            raise BrainUnavailable(f"{self.provider}: permission/credits nahi") from e
        except openai.RateLimitError as e:
            if "quota" in str(e).lower() or "credit" in str(e).lower() or "billing" in str(e).lower():
                raise BrainUnavailable(f"{self.provider}: quota/credits khatam") from e
            raise
        except openai.NotFoundError as e:
            if "model" in str(e).lower() and not getattr(self, "_model_retry", False):
                self._model_retry = True
                try:
                    new = pick_model(self.provider, [m.id for m in self.client.models.list()])
                except Exception:  # noqa: BLE001
                    new = None
                if new and new != self.model:
                    log.warning("%s: model %s not available, using %s", self.provider, self.model, new)
                    self.model = new
                    return self._create()
            raise BrainUnavailable(f"{self.provider}: model '{self.model}' nahi mila") from e
        except openai.APIStatusError as e:
            if e.status_code == 402 or "credit" in str(e).lower() or "balance" in str(e).lower():
                raise BrainUnavailable(f"{self.provider}: credits khatam") from e
            if e.status_code == 400 and self.images_ok and _has_images(self.messages):
                self.images_ok = False  # this model can't see images - drop them and retry
                self.messages = [_strip_images(m) for m in self.messages]
                return self._create()
            raise

    def handle(self, user_text: str) -> str | None:
        import openai

        stamp = datetime.now().strftime("%A, %d %B %Y, %I:%M %p")
        self.messages.append({"role": "user", "content": f"[{stamp}] {user_text}"})
        for _ in range(self.max_steps):
            if self.cancel.is_set():
                return None
            try:
                resp = self._create()
            except BrainUnavailable:
                raise
            except openai.RateLimitError:
                return "Abhi bahut requests ho gayi hain, ek minute baad try kariye."
            except openai.APIConnectionError:
                return "Internet se connect nahi ho pa rahi."
            except openai.APIStatusError as e:
                log.exception("provider error")
                return f"Kuch gadbad ho gayi, error {e.status_code}."
            msg = resp.choices[0].message
            calls = msg.tool_calls or []
            entry: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
            if calls:
                entry["tool_calls"] = [{"id": c.id, "type": "function",
                                        "function": {"name": c.function.name, "arguments": c.function.arguments}}
                                       for c in calls]
            self.messages.append(entry)
            if not calls:
                return (msg.content or "").strip() or "Ho gaya."
            if msg.content:
                self.on_status(msg.content)
            images = []
            for c in calls:
                if self.cancel.is_set():
                    self.messages.append({"role": "tool", "tool_call_id": c.id, "content": "Cancelled."})
                    continue
                try:
                    args = json.loads(c.function.arguments or "{}")
                except json.JSONDecodeError:
                    self.messages.append({"role": "tool", "tool_call_id": c.id,
                                          "content": "Invalid JSON arguments - please call again."})
                    continue
                self.on_status(f"[tool] {c.function.name}")
                content, is_error = self.tools.execute(c.function.name, args)
                text, imgs = _split_content(content)
                images += imgs
                self.messages.append({"role": "tool", "tool_call_id": c.id,
                                      "content": ("ERROR: " if is_error else "") + (text or "(empty)")})
            if images and self.images_ok:
                self.messages.append({"role": "user", "content": [{"type": "text", "text": "(Tool screenshot)"}] + [
                    {"type": "image_url", "image_url": {"url": f"data:{i['media_type']};base64,{i['data']}"}}
                    for i in images]})
        return "Ye kaam bahut steps le raha hai, maine abhi ke liye rok diya."


def _split_content(content) -> tuple[str, list[dict]]:
    if isinstance(content, str):
        return content, []
    texts, imgs = [], []
    for b in content or []:
        if b.get("type") == "text":
            texts.append(b["text"])
        elif b.get("type") == "image":
            imgs.append(b["source"])
    return "\n".join(texts), imgs


def _has_images(msgs) -> bool:
    return any(isinstance(m.get("content"), list) and any(p.get("type") == "image_url" for p in m["content"])
               for m in msgs)


def _strip_images(m: dict) -> dict:
    if isinstance(m.get("content"), list):
        return {**m, "content": " ".join(p.get("text", "") for p in m["content"] if p.get("type") == "text")}
    return m
