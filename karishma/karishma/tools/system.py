"""Mac control tools: shell, AppleScript, open apps/URLs, screenshot, ask/confirm user."""

from __future__ import annotations

import re
import shlex
import subprocess
import tempfile
from pathlib import Path

from ..config import Config
from .base import ToolError, ToolRegistry, UserIO, image_block, text_block

# Commands that only read information -> run without asking.
SAFE_COMMANDS = {
    "ls", "pwd", "cat", "head", "tail", "wc", "date", "cal", "whoami", "uptime", "df", "du",
    "sw_vers", "system_profiler", "pmset", "top", "ps", "which", "echo", "find", "mdfind",
    "grep", "uname", "hostname", "ifconfig", "networksetup", "ping", "curl", "file", "stat",
    "defaults", "brightness", "osascript", "open", "say", "sort", "uniq", "cut", "tr", "jq",
}
# Commands whose sub-arguments make them risky even if the binary is "safe".
RISKY_ARGS = re.compile(r"\b(write|delete|-w|--write|-X\s*(POST|PUT|DELETE))\b", re.I)
# Never allowed, even with confirmation.
BLOCKED = re.compile(
    r"(rm\s+-[a-z]*r[a-z]*f?\s+(/|~|\$HOME)\s*($|[;&|])|mkfs|diskutil\s+(erase|partition|zero)|"
    r":\(\)\s*\{|dd\s+if=.*of=/dev/|csrutil|nvram\s+-c|>\s*/dev/disk)",
    re.I,
)
SHELL_META = re.compile(r"[;&|`$<>]|\$\(")

RISKY_APPLESCRIPT = re.compile(
    r"\b(send|delete|empty trash|keystroke|key code|do shell script|shut ?down|restart|log out|"
    r"make new outgoing message|click|move .* to trash|erase)\b",
    re.I,
)


def is_safe_shell(command: str) -> bool:
    if SHELL_META.search(command.replace("2>/dev/null", "")):
        return False
    try:
        parts = shlex.split(command)
    except ValueError:
        return False
    if not parts:
        return False
    if parts[0] not in SAFE_COMMANDS or RISKY_ARGS.search(command):
        return False
    if parts[0] == "osascript":  # osascript is gated by run_applescript's rules
        return False
    if parts[0] == "curl" and any(p in parts for p in ("-o", "-O", "--output", "-d", "--data", "-T")):
        return False
    if parts[0] == "find" and any(p in parts for p in ("-delete", "-exec", "-execdir")):
        return False
    return True


def is_risky_applescript(script: str) -> bool:
    return bool(RISKY_APPLESCRIPT.search(script))


def register_system_tools(reg: ToolRegistry, cfg: Config, io: UserIO) -> None:
    @reg.add(
        "run_shell",
        "Run a zsh/bash command on the user's Mac and return stdout/stderr. Use for files, system info, "
        "installing nothing without asking. Read-only commands run directly; anything that changes the "
        "system is shown to the user for approval first.",
        {
            "command": {"type": "string", "description": "The shell command."},
            "reason": {"type": "string", "description": "One short line: why you are running it (shown to the user)."},
            "timeout_seconds": {"type": "integer", "description": "Default 60, max 600."},
        },
        ["command"],
    )
    def run_shell(command: str, reason: str = "", timeout_seconds: int = 60) -> str:
        if BLOCKED.search(command):
            raise ToolError("Blocked: this command could destroy the system. Not allowed.")
        if not is_safe_shell(command):
            if not io.confirm(f"Ye command chalaun? {reason or ''}".strip(), detail=f"$ {command}"):
                return "User declined. Do not run it; ask what they want instead."
        timeout = max(1, min(int(timeout_seconds or 60), 600))
        try:
            proc = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=timeout,
                executable="/bin/zsh" if Path("/bin/zsh").exists() else "/bin/bash",
            )
        except subprocess.TimeoutExpired:
            raise ToolError(f"Timed out after {timeout}s")
        out = (proc.stdout or "")[-12000:]
        err = (proc.stderr or "")[-4000:]
        return f"exit_code={proc.returncode}\nstdout:\n{out}\nstderr:\n{err}".strip()

    @reg.add(
        "run_applescript",
        "Run AppleScript via osascript to control macOS and apps: volume, brightness keys, Music/Spotify, "
        "Finder, Safari, Mail, Messages, Calendar, Reminders, Notes, System Events, notifications, dark mode, "
        "opening/closing/quitting apps. Scripts that send/delete/type keystrokes/click need user approval "
        "(the tool asks automatically).",
        {
            "script": {"type": "string", "description": "AppleScript source."},
            "reason": {"type": "string", "description": "One short line shown to the user."},
        },
        ["script"],
    )
    def run_applescript(script: str, reason: str = "") -> str:
        if not cfg.is_mac:
            raise ToolError("AppleScript only works on macOS.")
        if is_risky_applescript(script):
            if not io.confirm(f"Ye Mac par karun? {reason or ''}".strip(), detail=script):
                return "User declined. Do not do it."
        proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise ToolError(
                f"osascript error: {proc.stderr.strip()}\n(If it says 'not allowed', the user must allow "
                "Terminal in System Settings > Privacy & Security > Automation/Accessibility.)"
            )
        return proc.stdout.strip() or "done"

    @reg.add(
        "open_item",
        "Open an app (e.g. 'Spotify'), a URL in the user's default browser, or a file/folder path on the Mac.",
        {"target": {"type": "string", "description": "App name, URL, or path."}},
        ["target"],
    )
    def open_item(target: str) -> str:
        if not cfg.is_mac:
            raise ToolError("open_item only works on macOS.")
        if re.match(r"^[a-z]+://", target) or Path(target).expanduser().exists():
            args = ["open", str(Path(target).expanduser()) if not re.match(r"^[a-z]+://", target) else target]
        else:
            args = ["open", "-a", target]
        proc = subprocess.run(args, capture_output=True, text=True, timeout=30)
        if proc.returncode != 0:
            raise ToolError(proc.stderr.strip() or "could not open")
        return f"opened {target}"

    @reg.add(
        "screenshot_screen",
        "Take a screenshot of the user's whole Mac screen to SEE what is on it right now.",
        {},
    )
    def screenshot_screen():
        if not cfg.is_mac:
            raise ToolError("screenshot_screen only works on macOS.")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "screen.jpg"
            proc = subprocess.run(["screencapture", "-x", "-t", "jpg", str(p)], capture_output=True, text=True)
            if proc.returncode != 0 or not p.exists():
                raise ToolError("screencapture failed - allow Screen Recording for Terminal in System Settings.")
            subprocess.run(["sips", "-Z", "1568", str(p)], capture_output=True)
            return [text_block("Current screen:"), image_block(p.read_bytes(), "image/jpeg")]

    @reg.add(
        "ask_user",
        "Ask the user a question out loud and get their spoken answer. Use when you need details "
        "(date, city, budget, which option) instead of guessing.",
        {"question": {"type": "string"}},
        ["question"],
    )
    def ask_user(question: str) -> str:
        answer = io.ask(question)
        return answer or "(no answer heard)"

    if hasattr(io, "show_cards"):
        @reg.add(
            "show_cards",
            "Show results on screen as Siri-style cards (title, short summary, source). Use it when the user "
            "asks about a person, company, place, product, news, prices or options (flights, hotels, "
            "restaurants) - 2 to 5 cards - then SPEAK only a 1-2 sentence summary.",
            {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Bold first line"},
                            "subtitle": {"type": "string", "description": "1-2 line summary"},
                            "url": {"type": "string", "description": "Link opened when clicked"},
                            "source": {"type": "string", "description": "e.g. linkedin.com, IndiGo"},
                        },
                        "required": ["title"],
                    },
                }
            },
            ["items"],
        )
        def show_cards(items: list) -> str:
            io.show_cards(items if isinstance(items, list) else [])
            return f"shown {len(items) if isinstance(items, list) else 0} card(s) on screen"

    @reg.add(
        "confirm_with_user",
        "REQUIRED before any booking, purchase, order, payment, sending a message/email, or deleting. "
        "summary = ONE short spoken sentence (what + price/date/to whom). Put long details (lists, "
        "commands, addresses) in 'detail' - they are shown on screen, not read aloud.",
        {"summary": {"type": "string", "description": "One short sentence, spoken."},
         "detail": {"type": "string", "description": "Optional longer details, shown only."}},
        ["summary"],
    )
    def confirm_with_user(summary: str, detail: str = "") -> str:
        return "APPROVED by user" if io.confirm(summary, detail=detail) else "DECLINED by user - do not proceed."
