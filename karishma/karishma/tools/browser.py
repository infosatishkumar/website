"""Web browser automation (Playwright) for booking tickets, ordering, filling forms.

Runs a real, visible browser window with its own saved profile (~/.karishma/browser-profile),
so once the user logs in to IRCTC / MakeMyTrip / Amazon / Swiggy etc. they stay logged in.
"""

from __future__ import annotations

import re
from typing import Any

from ..config import Config
from .base import ToolError, ToolRegistry, UserIO, image_block, text_block

# Clicking anything matching this needs a spoken "yes" from the user - enforced in code.
MONEY_WORDS = re.compile(
    r"(pay|payment|place\s*order|buy\s*now|book\s*now|confirm\s*(booking|order|payment)|"
    r"proceed\s*to\s*(pay|payment|checkout)|make\s*payment|checkout|submit\s*order|"
    r"complete\s*(purchase|booking)|subscribe|भुगतान|बुक\s*करें)",
    re.I,
)
SECRET_FIELDS = re.compile(r"(card|cvv|cvc|otp|password|passcode|upi\s*pin|\bpin\b|expiry)", re.I)

MARK_JS = r"""
() => {
  document.querySelectorAll('[data-kid]').forEach(e => e.removeAttribute('data-kid'));
  const sel = 'a[href], button, input, select, textarea, [role=button], [role=link], [role=tab], ' +
              '[role=option], [role=menuitem], [role=checkbox], [role=radio], [onclick], [contenteditable=true], label, summary';
  const out = [];
  let id = 0;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || st.visibility === 'hidden' || st.display === 'none') continue;
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    id += 1;
    el.setAttribute('data-kid', String(id));
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
                 el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ');
    out.push({id, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || el.getAttribute('role') || '',
              text: txt.slice(0, 80), inView: r.top >= 0 && r.top <= innerHeight});
    if (id >= 250) break;
  }
  return out;
}
"""


class Browser:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._pw = None
        self._ctx = None
        self._page = None
        self._elements: dict[int, dict[str, Any]] = {}

    # ---- lifecycle -------------------------------------------------------
    def _ensure(self):
        if self._page is not None and not self._page.is_closed():
            return self._page
        if self._ctx is None:
            from playwright.sync_api import sync_playwright

            self._pw = sync_playwright().start()
            kwargs: dict[str, Any] = dict(
                user_data_dir=str(self.cfg.browser_profile),
                headless=self.cfg.browser_headless,
                viewport={"width": 1280, "height": 800},
                locale="en-IN",
                timezone_id="Asia/Kolkata",
            )
            if self.cfg.browser_executable:
                kwargs["executable_path"] = self.cfg.browser_executable
            elif self.cfg.browser_channel == "chrome":
                kwargs["channel"] = "chrome"
            self._ctx = self._pw.chromium.launch_persistent_context(**kwargs)
            self._ctx.on("page", self._on_new_page)
        pages = [p for p in self._ctx.pages if not p.is_closed()]
        self._page = pages[-1] if pages else self._ctx.new_page()
        return self._page

    def _on_new_page(self, page):  # follow links that open a new tab
        self._page = page

    def close(self):
        try:
            if self._ctx:
                self._ctx.close()
            if self._pw:
                self._pw.stop()
        finally:
            self._ctx = self._pw = self._page = None

    # ---- actions ---------------------------------------------------------
    def snapshot(self, include_text: bool = True) -> str:
        page = self._ensure()
        try:
            page.wait_for_load_state("domcontentloaded", timeout=10000)
        except Exception:
            pass
        elements = page.evaluate(MARK_JS)
        self._elements = {e["id"]: e for e in elements}
        lines = [f"URL: {page.url}", f"Title: {page.title()}"]
        if include_text:
            body = page.evaluate("() => document.body ? document.body.innerText : ''") or ""
            body = re.sub(r"\n\s*\n+", "\n", body).strip()
            lines.append("--- Page text (trimmed) ---")
            lines.append(body[:6000])
        lines.append("--- Interactive elements [id] tag(type) text ---")
        for e in elements:
            mark = "" if e["inView"] else " (below, scroll)"
            lines.append(f"[{e['id']}] {e['tag']}({e['type']}) {e['text']}{mark}")
        return "\n".join(lines)

    def _locator(self, element_id: int):
        page = self._ensure()
        loc = page.locator(f'[data-kid="{int(element_id)}"]')
        if loc.count() == 0:
            raise ToolError("Element id not found - call browser with action 'snapshot' again.")
        return loc.first


def register_browser_tools(reg: ToolRegistry, cfg: Config, io: UserIO) -> Browser:
    br = Browser(cfg)

    @reg.add(
        "browser",
        "Control a real web browser window to research, compare prices, book tickets (flights, trains/IRCTC, "
        "buses, movies, hotels), order food/products, fill forms. Workflow: 'open' a URL -> read the snapshot "
        "(page text + numbered elements) -> 'click'/'type'/'select' by element id -> 'snapshot' again. "
        "Use 'screenshot' when the layout matters (seat maps, captchas). Never type card numbers, CVV, OTP, "
        "UPI PIN or passwords - ask the user to type those in the browser window themselves, then use "
        "'wait_for_user'. Payment/booking buttons require user approval (checked automatically).",
        {
            "action": {
                "type": "string",
                "enum": ["open", "snapshot", "click", "type", "select", "press", "scroll", "back",
                         "screenshot", "wait_for_user", "close"],
            },
            "url": {"type": "string", "description": "For 'open'."},
            "element_id": {"type": "integer", "description": "For click/type/select."},
            "text": {"type": "string", "description": "For 'type' (text) / 'select' (option label) / 'press' (key, e.g. Enter) / 'wait_for_user' (what the user should do)."},
            "submit": {"type": "boolean", "description": "For 'type': press Enter afterwards."},
            "direction": {"type": "string", "enum": ["down", "up"], "description": "For 'scroll'."},
        },
        ["action"],
    )
    def browser(action: str, url: str = "", element_id: int | None = None, text: str = "",
                submit: bool = False, direction: str = "down"):
        if action == "close":
            br.close()
            return "browser closed"
        page = br._ensure()
        if action == "open":
            if not url:
                raise ToolError("url required")
            if not re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
                url = "https://" + url
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(1200)
            return br.snapshot()
        if action == "snapshot":
            return br.snapshot()
        if action == "screenshot":
            data = page.screenshot(type="jpeg", quality=60)
            return [text_block(f"Screenshot of {page.url}"), image_block(data, "image/jpeg")]
        if action in ("click", "type", "select"):
            if element_id is None:
                raise ToolError("element_id required")
            info = br._elements.get(int(element_id), {})
            loc = br._locator(element_id)
            if action == "click":
                label = info.get("text", "") or (loc.inner_text(timeout=2000) if loc else "")
                if MONEY_WORDS.search(label or ""):
                    if not io.confirm(f"'{label}' button dabane wali hoon (payment/booking). Aage badhun?"):
                        return "DECLINED by user - did not click."
                loc.scroll_into_view_if_needed(timeout=5000)
                loc.click(timeout=10000)
                page.wait_for_timeout(1500)
                return br.snapshot()
            if action == "type":
                if SECRET_FIELDS.search(info.get("text", "")) or (info.get("type") == "password"):
                    raise ToolError("This looks like a password/card/OTP field. Ask the user to type it themselves "
                                    "and then call wait_for_user.")
                loc.fill(text, timeout=10000)
                if submit:
                    loc.press("Enter")
                page.wait_for_timeout(1000)
                return br.snapshot(include_text=submit)
            if action == "select":
                try:
                    loc.select_option(label=text, timeout=5000)
                except Exception:
                    loc.select_option(text, timeout=5000)
                return br.snapshot(include_text=False)
        if action == "press":
            page.keyboard.press(text or "Enter")
            page.wait_for_timeout(1000)
            return br.snapshot()
        if action == "scroll":
            page.mouse.wheel(0, 700 if direction != "up" else -700)
            page.wait_for_timeout(600)
            return br.snapshot()
        if action == "back":
            page.go_back(timeout=20000)
            return br.snapshot()
        if action == "wait_for_user":
            io.ask((text or "Browser me apna step complete kar lijiye") + " — ho jaye to 'ho gaya' boliye.")
            return br.snapshot()
        raise ToolError(f"unknown action {action}")

    return br
