"""Everything the agent can do on the Mac, exposed to Claude as tools."""

import base64
import datetime as dt
import difflib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import urllib.parse
from pathlib import Path

from .config import WORKSPACE

MAX_OUTPUT = 6000

APP_DIRS = [
    "/Applications",
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
    "/System/Library/CoreServices/Applications",
    str(Path.home() / "Applications"),
    "/Applications/Setapp",
]

APP_ALIASES = {
    "chrome": "Google Chrome",
    "google chrome": "Google Chrome",
    "google": "Google Chrome",
    "browser": "Google Chrome",
    "vs code": "Visual Studio Code",
    "vscode": "Visual Studio Code",
    "code": "Visual Studio Code",
    "settings": "System Settings",
    "system preferences": "System Settings",
    "setting": "System Settings",
    "whatsapp": "WhatsApp",
    "word": "Microsoft Word",
    "excel": "Microsoft Excel",
    "powerpoint": "Microsoft PowerPoint",
    "outlook": "Microsoft Outlook",
    "teams": "Microsoft Teams",
    "premiere": "Adobe Premiere Pro",
    "photoshop": "Adobe Photoshop",
    "illustrator": "Adobe Illustrator",
    "final cut": "Final Cut Pro",
    "files": "Finder",
    "file manager": "Finder",
    "camera": "Photo Booth",
    "music": "Music",
    "gaana": "Music",
    "terminal": "Terminal",
    "calculator": "Calculator",
    "notes": "Notes",
    "calendar": "Calendar",
    "mail": "Mail",
    "app store": "App Store",
}

SEARCH_URLS = {
    "google": "https://www.google.com/search?q={q}",
    "youtube": "https://www.youtube.com/results?search_query={q}",
    "images": "https://www.google.com/search?tbm=isch&q={q}",
    "maps": "https://www.google.com/maps/search/{q}",
    "news": "https://news.google.com/search?q={q}",
    "amazon": "https://www.amazon.in/s?k={q}",
    "flipkart": "https://www.flipkart.com/search?q={q}",
    "wikipedia": "https://en.wikipedia.org/w/index.php?search={q}",
    "github": "https://github.com/search?q={q}",
}

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    str(Path.home() / "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]

# Commands that can destroy data or change the system: the agent must ask first.
DANGEROUS_SHELL = re.compile(
    r"(\brm\s|\brmdir\b|\bsudo\b|\bmkfs|\bdiskutil\s+(erase|partition|zero)|\bdd\s|\bshutdown\b|\breboot\b|"
    r"\bhalt\b|\bkillall\b|\bpkill\b|\blaunchctl\b|\bchmod\s+-R|\bchown\b|>\s*/dev/|\bcurl\b[^|]*\|\s*(ba|z)?sh|"
    r"\bdefaults\s+delete|\bcsrutil\b|\bnvram\b|\bsrm\b|\btrash\b|\bmv\s|\bgit\s+(push|reset|clean)|"
    r"\bnpm\s+publish|\bbrew\s+uninstall|\bcrontab\b)",
    re.I,
)
DANGEROUS_APPLESCRIPT = re.compile(
    r"(\bdelete\b|empty\s+trash|shut\s*down|restart|log\s*out|\bsend\b|do shell script)", re.I
)


def _expand(path):
    return Path(os.path.expanduser(str(path))).resolve()


def _truncate(text, limit=MAX_OUTPUT):
    text = text or ""
    return text if len(text) <= limit else text[: limit // 2] + "\n…(output cut)…\n" + text[-limit // 2 :]


def _run(cmd, timeout=120, shell=False, input_text=None):
    proc = subprocess.run(
        cmd, shell=shell, capture_output=True, text=True, timeout=timeout, input=input_text
    )
    out = (proc.stdout or "") + (("\n[stderr]\n" + proc.stderr) if proc.stderr.strip() else "")
    return proc.returncode, out.strip()


def _osascript(script, timeout=60):
    code, out = _run(["osascript", "-e", script], timeout=timeout)
    if code != 0:
        raise RuntimeError(out or "AppleScript failed")
    return out


def _as_string(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _which(name):
    found = shutil.which(name)
    if found:
        return found
    for prefix in ("/opt/homebrew/bin", "/usr/local/bin"):
        candidate = Path(prefix) / name
        if candidate.exists():
            return str(candidate)
    if name == "ffmpeg":
        # Bundled ffmpeg from the imageio-ffmpeg package (no Homebrew needed).
        try:
            import imageio_ffmpeg

            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return None
    return None


def _installed_apps():
    apps = {}
    for folder in APP_DIRS:
        base = Path(folder)
        if not base.is_dir():
            continue
        for entry in base.iterdir():
            if entry.suffix == ".app":
                apps.setdefault(entry.stem, str(entry))
            elif entry.is_dir() and not entry.name.startswith("."):
                # Apps inside vendor folders, e.g. /Applications/Adobe Photoshop 2025/
                for sub in entry.glob("*.app"):
                    apps.setdefault(sub.stem, str(sub))
    return apps


def find_app(name):
    """Best match for a spoken app name -> (display name, path) or (None, suggestions)."""
    apps = _installed_apps()
    wanted = name.strip().lower().removesuffix(".app")
    wanted = APP_ALIASES.get(wanted, wanted).lower()
    by_lower = {k.lower(): k for k in apps}
    if wanted in by_lower:
        key = by_lower[wanted]
        return key, apps[key]
    starts = [k for k in apps if k.lower().startswith(wanted)]
    contains = [k for k in apps if wanted in k.lower()]
    for group in (starts, contains):
        if group:
            key = sorted(group, key=len)[0]
            return key, apps[key]
    close = difflib.get_close_matches(wanted, list(by_lower), n=3, cutoff=0.6)
    if close:
        key = by_lower[close[0]]
        return key, apps[key]
    suggestions = difflib.get_close_matches(wanted, list(by_lower), n=5, cutoff=0.3)
    return None, [by_lower[s] for s in suggestions]


def _tool(name, description, properties, required=()):
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": list(required),
        },
    }


TOOL_DEFINITIONS = [
    _tool(
        "open_app",
        "Open (launch or bring to front) any installed Mac application by its spoken name, e.g. "
        "'chrome', 'whatsapp', 'vs code', 'photoshop'. Fuzzy-matches installed apps.",
        {"name": {"type": "string", "description": "App name as the user said it."}},
        ["name"],
    ),
    _tool(
        "quit_app",
        "Quit a running Mac application by name.",
        {"name": {"type": "string"}},
        ["name"],
    ),
    _tool(
        "list_apps",
        "List installed applications (installed=true) or the apps that are currently running.",
        {"installed": {"type": "boolean", "description": "true = installed apps, false = running apps."}},
    ),
    _tool(
        "open_url",
        "Open a web page in the browser (Google Chrome by default).",
        {
            "url": {"type": "string"},
            "browser": {"type": "string", "description": "Optional app name, default 'Google Chrome'."},
        },
        ["url"],
    ),
    _tool(
        "browser_search",
        "Open a search in Chrome for the user to look at (Google, YouTube, images, maps, news, "
        "amazon, flipkart, wikipedia, github). For answering questions yourself, use web_search instead.",
        {
            "query": {"type": "string"},
            "engine": {"type": "string", "enum": sorted(SEARCH_URLS)},
        },
        ["query"],
    ),
    _tool(
        "chrome_tabs",
        "Read or control Google Chrome: list open tabs, read the text of the active tab, "
        "switch to a tab, close the active tab, or run JavaScript in the active tab.",
        {
            "action": {"type": "string", "enum": ["list", "read_active", "switch", "close_active", "run_js"]},
            "tab_index": {"type": "integer", "description": "1-based tab number for 'switch' (from 'list')."},
            "javascript": {"type": "string", "description": "Code for 'run_js'. Its result is returned."},
        },
        ["action"],
    ),
    _tool(
        "run_applescript",
        "Run AppleScript to control Mac apps (Finder, Music, Spotify, Notes, Reminders, Calendar, "
        "Mail, Messages, System Events...). Scripts that delete, send, restart or run shell commands "
        "need confirmed=true, which you may only set after the user said yes.",
        {"script": {"type": "string"}, "confirmed": {"type": "boolean"}},
        ["script"],
    ),
    _tool(
        "run_shell",
        "Run a zsh command on the Mac and return its output (timeout 5 min). Use for files, "
        "brew, git, python, conversions etc. Commands that delete, move, use sudo, kill processes "
        "or change the system need confirmed=true, which you may only set after the user said yes.",
        {
            "command": {"type": "string"},
            "cwd": {"type": "string", "description": "Working directory, default the agent workspace."},
            "confirmed": {"type": "boolean"},
        },
        ["command"],
    ),
    _tool(
        "list_directory",
        "List files in a folder (e.g. ~/Desktop, ~/Downloads).",
        {"path": {"type": "string"}},
        ["path"],
    ),
    _tool(
        "read_file",
        "Read a text file (first 20,000 characters).",
        {"path": {"type": "string"}},
        ["path"],
    ),
    _tool(
        "write_file",
        "Create or overwrite a text file (notes, research reports in Markdown, scripts, HTML...). "
        "Relative paths go into the agent workspace ~/Documents/AI-Agent. Overwriting an existing "
        "file outside the workspace needs confirmed=true after the user said yes.",
        {
            "path": {"type": "string"},
            "content": {"type": "string"},
            "open_after": {"type": "boolean", "description": "Open the file when done."},
            "confirmed": {"type": "boolean"},
        },
        ["path", "content"],
    ),
    _tool(
        "open_path",
        "Open a file or folder with its default app (Preview, QuickTime, Finder...), or reveal it in Finder.",
        {"path": {"type": "string"}, "reveal": {"type": "boolean"}},
        ["path"],
    ),
    _tool(
        "create_poster",
        "Design a poster / banner / social-media post / thumbnail / flyer / card. You write a complete, "
        "self-contained HTML page (inline CSS; Google Fonts, gradients, emoji, SVG and local images "
        "via file:// paths are fine) sized exactly width x height pixels; it is rendered to PNG (or PDF) "
        "with Chrome and opened in Preview. Make it look professional: strong hierarchy, big headline, "
        "good contrast, balanced spacing. Common sizes: Instagram post 1080x1080, story/reel 1080x1920, "
        "portrait post 1080x1350, YouTube thumbnail 1280x720, A4 poster 1240x1754.",
        {
            "html": {"type": "string"},
            "width": {"type": "integer"},
            "height": {"type": "integer"},
            "filename": {"type": "string", "description": "Short file name without extension."},
            "format": {"type": "string", "enum": ["png", "pdf"]},
        },
        ["html", "width", "height", "filename"],
    ),
    _tool(
        "media_info",
        "Get duration, resolution, codecs and streams of a video/audio/image file (ffprobe).",
        {"path": {"type": "string"}},
        ["path"],
    ),
    _tool(
        "run_ffmpeg",
        "Edit video/audio with ffmpeg: trim, cut, merge/concat, resize for reels (1080x1920), crop, "
        "speed up, add music, mute, add text/subtitles (drawtext/subtitles), watermark, fade, "
        "extract audio, make GIF, compress, convert formats. Pass the arguments that follow `ffmpeg` "
        "(input -i ... through the output path) as a list. -y is added automatically. Never overwrite "
        "the user's original file: write outputs to a new name, by default in ~/Documents/AI-Agent/videos. "
        "The output is opened when done.",
        {
            "args": {"type": "array", "items": {"type": "string"}},
            "output_path": {"type": "string", "description": "The output file (also last in args)."},
            "open_after": {"type": "boolean"},
        },
        ["args", "output_path"],
    ),
    _tool(
        "take_screenshot",
        "Take a screenshot of the Mac screen so you can see what the user is looking at. "
        "Optionally save a copy to the Desktop.",
        {"save_to_desktop": {"type": "boolean"}},
    ),
    _tool(
        "keyboard",
        "Type text or press a keyboard shortcut in the frontmost app (needs Accessibility permission). "
        "Shortcut format: 'cmd+t', 'cmd+shift+n', 'return', 'esc', 'tab', 'space', 'up', 'down'.",
        {
            "text": {"type": "string", "description": "Text to type."},
            "shortcut": {"type": "string", "description": "Key combo to press."},
        },
    ),
    _tool(
        "clipboard",
        "Read the clipboard, or copy text to it.",
        {"action": {"type": "string", "enum": ["read", "write"]}, "text": {"type": "string"}},
        ["action"],
    ),
    _tool(
        "system_control",
        "Quick Mac controls: set volume (0-100), mute/unmute, toggle dark mode, lock screen, "
        "put display to sleep, show a notification, get battery status, get Wi-Fi name.",
        {
            "action": {
                "type": "string",
                "enum": ["volume", "mute", "unmute", "dark_mode", "lock", "display_sleep",
                         "notify", "battery", "wifi"],
            },
            "value": {"type": "string", "description": "Volume level, or notification text."},
        },
        ["action"],
    ),
    _tool(
        "set_timer",
        "Set a reminder/timer. After the given minutes the agent speaks the message and shows a notification.",
        {"minutes": {"type": "number"}, "message": {"type": "string"}},
        ["minutes", "message"],
    ),
    _tool(
        "update_user",
        "Speak a short progress update to the user in the middle of a longer task "
        "(e.g. 'Research shuru kar di hai', 'Video trim ho gaya, ab music add kar rahi hoon'). "
        "Keep it to one short sentence.",
        {"message": {"type": "string"}},
        ["message"],
    ),
    _tool(
        "change_identity",
        "Change the agent's own settings when the user asks: its name, the wake word it activates on, "
        "the user's name, the voice, speaking speed, or whether replies are spoken. When the wake word "
        "changes, also pass wake_aliases: likely speech-recognition spellings of it, including the "
        "Devanagari spelling and English sound-alikes (e.g. Karishma -> ['karishma','करिश्मा','charisma','krishma']).",
        {
            "agent_name": {"type": "string"},
            "wake_word": {"type": "string"},
            "wake_aliases": {"type": "array", "items": {"type": "string"}},
            "user_name": {"type": "string"},
            "voice": {"type": "string", "description": "A macOS `say` voice name, e.g. 'Veena', 'Rishi', 'Lekha'."},
            "speech_rate": {"type": "integer", "description": "Words per minute, 120-260."},
            "speak_replies": {"type": "boolean"},
        },
    ),
    _tool(
        "go_to_sleep",
        "Stop listening for follow-ups and wait for the wake word again. Use when the user says bye, "
        "'bas', 'so jao', 'thank you that's all' etc.",
        {},
    ),
]


class Toolbox:
    def __init__(self, agent):
        self.agent = agent
        self.config = agent.config
        (WORKSPACE / "posters").mkdir(parents=True, exist_ok=True)
        (WORKSPACE / "videos").mkdir(parents=True, exist_ok=True)
        (WORKSPACE / "research").mkdir(parents=True, exist_ok=True)

    # A short human-readable label shown in the UI while a tool runs.
    def describe(self, name, args):
        labels = {
            "open_app": f"Opening {args.get('name', '')}",
            "quit_app": f"Closing {args.get('name', '')}",
            "open_url": "Opening browser",
            "browser_search": f"Searching {args.get('engine', 'google')}: {args.get('query', '')}",
            "chrome_tabs": "Working in Chrome",
            "run_applescript": "Controlling apps",
            "run_shell": f"Running: {args.get('command', '')[:60]}",
            "list_directory": f"Looking in {args.get('path', '')}",
            "read_file": f"Reading {Path(args.get('path', '')).name}",
            "write_file": f"Writing {Path(args.get('path', '')).name}",
            "open_path": f"Opening {Path(args.get('path', '')).name}",
            "create_poster": f"Designing poster: {args.get('filename', '')}",
            "media_info": "Checking media file",
            "run_ffmpeg": f"Editing video → {Path(args.get('output_path', '')).name}",
            "take_screenshot": "Looking at the screen",
            "keyboard": "Typing",
            "clipboard": "Clipboard",
            "system_control": f"System: {args.get('action', '')}",
            "set_timer": "Setting timer",
            "update_user": "Update",
            "change_identity": "Updating my settings",
            "go_to_sleep": "Going to sleep",
            "web_search": "Searching the web",
            "web_fetch": "Reading a web page",
        }
        return labels.get(name, name)

    def run(self, name, args):
        handler = getattr(self, f"t_{name}", None)
        if handler is None:
            return f"Unknown tool {name}", True
        try:
            return handler(**args), False
        except subprocess.TimeoutExpired:
            return "Timed out.", True
        except TypeError as exc:
            return f"Bad arguments: {exc}", True
        except Exception as exc:
            return f"Error: {exc}", True

    # ---- apps & browser ----------------------------------------------------

    def t_open_app(self, name):
        app, path = find_app(name)
        if app is None:
            hint = f" Did you mean: {', '.join(path)}?" if path else ""
            return f"No installed app matches '{name}'.{hint}"
        code, out = _run(["open", "-a", path])
        return f"Opened {app}." if code == 0 else f"Could not open {app}: {out}"

    def t_quit_app(self, name):
        app, path = find_app(name)
        app = app or name
        _osascript(f"tell application {_as_string(app)} to quit")
        return f"Quit {app}."

    def t_list_apps(self, installed=True):
        if installed:
            return ", ".join(sorted(_installed_apps()))
        return _osascript(
            'tell application "System Events" to get name of every application process whose background only is false'
        )

    def t_open_url(self, url, browser="Google Chrome"):
        if not re.match(r"^[a-z]+://", url):
            url = "https://" + url
        app, path = find_app(browser or "Google Chrome")
        cmd = ["open", "-a", path, url] if app else ["open", url]
        code, out = _run(cmd)
        return f"Opened {url} in {app or 'default browser'}." if code == 0 else out

    def t_browser_search(self, query, engine="google"):
        template = SEARCH_URLS.get(engine, SEARCH_URLS["google"])
        return self.t_open_url(template.format(q=urllib.parse.quote_plus(query)))

    def t_chrome_tabs(self, action, tab_index=None, javascript=None):
        chrome = 'application "Google Chrome"'
        if action == "list":
            out = _osascript(
                f"""set out to ""
tell {chrome}
  set i to 0
  repeat with t in tabs of front window
    set i to i + 1
    set out to out & i & ". " & (title of t) & " — " & (URL of t) & linefeed
  end repeat
end tell
return out"""
            )
            return out or "No tabs open."
        if action == "switch":
            _osascript(f"tell {chrome} to set active tab index of front window to {int(tab_index or 1)}")
            return f"Switched to tab {tab_index}."
        if action == "close_active":
            _osascript(f"tell {chrome} to close active tab of front window")
            return "Closed the tab."
        if action == "read_active":
            javascript = "document.title + '\\n' + location.href + '\\n\\n' + document.body.innerText"
        if not javascript:
            return "Nothing to run."
        # Needs Chrome > View > Developer > Allow JavaScript from Apple Events.
        out = _osascript(
            f"tell {chrome} to execute active tab of front window javascript {_as_string(javascript)}"
        )
        return _truncate(out, 20000)

    def t_run_applescript(self, script, confirmed=False):
        if DANGEROUS_APPLESCRIPT.search(script) and not confirmed:
            return ("NEEDS_CONFIRMATION: this script can delete/send/restart. Tell the user exactly what "
                    "it will do and ask for a yes before running it again with confirmed=true.")
        return _truncate(_osascript(script, timeout=120)) or "Done."

    # ---- shell & files -----------------------------------------------------

    def t_run_shell(self, command, cwd=None, confirmed=False):
        if DANGEROUS_SHELL.search(command) and not confirmed:
            return ("NEEDS_CONFIRMATION: this command can delete, move or change things. Tell the user "
                    "what it will do and ask for a yes before running it again with confirmed=true.")
        workdir = _expand(cwd) if cwd else WORKSPACE
        proc = subprocess.run(
            ["/bin/zsh", "-lc", command], cwd=workdir, capture_output=True, text=True, timeout=300
        )
        out = (proc.stdout or "") + (("\n[stderr]\n" + proc.stderr) if proc.stderr.strip() else "")
        return f"exit code {proc.returncode}\n{_truncate(out.strip())}"

    def t_list_directory(self, path):
        folder = _expand(path)
        if not folder.is_dir():
            return f"{folder} is not a folder."
        entries = sorted(folder.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)[:200]
        lines = []
        for p in entries:
            if p.name.startswith("."):
                continue
            kind = "📁" if p.is_dir() else f"{p.stat().st_size // 1024} KB"
            modified = dt.datetime.fromtimestamp(p.stat().st_mtime).strftime("%d %b %H:%M")
            lines.append(f"{p.name}  ({kind}, {modified})")
        return f"{folder} (newest first):\n" + "\n".join(lines)

    def t_read_file(self, path):
        return _expand(path).read_text(errors="replace")[:20000]

    def t_write_file(self, path, content, open_after=False, confirmed=False):
        target = Path(os.path.expanduser(path))
        if not target.is_absolute():
            target = WORKSPACE / target
        target = target.resolve()
        inside_workspace = WORKSPACE.resolve() in target.parents
        if target.exists() and not inside_workspace and not confirmed:
            return f"NEEDS_CONFIRMATION: {target} already exists. Ask the user before overwriting it."
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        if open_after:
            _run(["open", str(target)])
        return f"Saved {target}"

    def t_open_path(self, path, reveal=False):
        target = _expand(path)
        if not target.exists():
            return f"{target} does not exist."
        _run(["open", "-R", str(target)] if reveal else ["open", str(target)])
        return f"Opened {target}"

    # ---- creative ----------------------------------------------------------

    def t_create_poster(self, html, width, height, filename, format="png"):
        chrome = next((p for p in CHROME_PATHS if Path(p).exists()), None)
        if chrome is None:
            return "Google Chrome is needed to render posters. Ask the user to install Chrome."
        safe = re.sub(r"[^\w\-]+", "-", filename).strip("-") or "poster"
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        base = WORKSPACE / "posters" / f"{safe}-{stamp}"
        html_path = base.with_suffix(".html")
        html_path.write_text(html)
        out_path = base.with_suffix("." + ("pdf" if format == "pdf" else "png"))
        with tempfile.TemporaryDirectory() as profile:
            cmd = [
                chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--no-first-run", "--no-default-browser-check", f"--user-data-dir={profile}",
                "--allow-file-access-from-files", "--virtual-time-budget=6000",
                f"--window-size={int(width)},{int(height)}",
            ]
            if format == "pdf":
                cmd += ["--no-pdf-header-footer", f"--print-to-pdf={out_path}"]
            else:
                cmd += ["--force-device-scale-factor=2", f"--screenshot={out_path}"]
            cmd.append(html_path.as_uri())
            _run(cmd, timeout=90)
        if not out_path.exists():
            return "Rendering failed; check the HTML."
        _run(["open", "-a", "Preview", str(out_path)])
        return f"Poster saved to {out_path} (HTML source {html_path}) and opened in Preview."

    def t_media_info(self, path):
        target = str(_expand(path))
        ffprobe = _which("ffprobe")
        if ffprobe:
            code, out = _run([
                ffprobe, "-v", "error", "-show_entries",
                "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
                "-of", "json", target,
            ])
            return out
        ffmpeg = _which("ffmpeg")
        if not ffmpeg:
            return "ffmpeg not found."
        # `ffmpeg -i` with no output prints the file's streams and duration.
        _code, out = _run([ffmpeg, "-hide_banner", "-i", target])
        return _truncate(out.replace("[stderr]", "").strip(), 3000)

    def t_run_ffmpeg(self, args, output_path, open_after=True):
        ffmpeg = _which("ffmpeg")
        if not ffmpeg:
            return "ffmpeg not found. Run setup.sh again."
        args = [os.path.expanduser(a) if a.startswith("~") else a for a in args]
        out = Path(os.path.expanduser(output_path))
        if not out.is_absolute():
            out = WORKSPACE / "videos" / out
            args = [str(out) if a == output_path else a for a in args]
        inputs = {str(_expand(args[i + 1])) for i, a in enumerate(args[:-1]) if a == "-i"}
        if str(out.resolve()) in inputs:
            return "Output path is the same as an input. Use a new file name."
        out.parent.mkdir(parents=True, exist_ok=True)
        code, log = _run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *args], timeout=3600)
        if code != 0 or not out.exists():
            return f"ffmpeg failed (exit {code}):\n{_truncate(log, 3000)}"
        if open_after:
            _run(["open", str(out)])
        return f"Done: {out} ({out.stat().st_size // 1024} KB)"

    # ---- screen, keyboard, system -------------------------------------------

    def t_take_screenshot(self, save_to_desktop=False):
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "screen.png"
            _run(["screencapture", "-x", str(png)])
            if not png.exists():
                return "Screenshot failed. Allow Screen Recording in System Settings > Privacy & Security."
            if save_to_desktop:
                name = dt.datetime.now().strftime("Screenshot %Y-%m-%d at %H.%M.%S.png")
                shutil.copy(png, Path.home() / "Desktop" / name)
            jpg = Path(tmp) / "screen.jpg"
            _run(["sips", "-Z", "1568", "-s", "format", "jpeg", str(png), "--out", str(jpg)])
            data = base64.standard_b64encode(jpg.read_bytes()).decode()
        return [
            {"type": "text", "text": "Current screen:" + (" (copy saved to Desktop)" if save_to_desktop else "")},
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
        ]

    def t_keyboard(self, text=None, shortcut=None):
        if text:
            _osascript(f'tell application "System Events" to keystroke {_as_string(text)}')
        if shortcut:
            codes = {"return": 36, "enter": 36, "tab": 48, "space": 49, "delete": 51, "backspace": 51,
                     "esc": 53, "escape": 53, "left": 123, "right": 124, "down": 125, "up": 126}
            mods = {"cmd": "command down", "command": "command down", "shift": "shift down",
                    "alt": "option down", "option": "option down", "ctrl": "control down",
                    "control": "control down"}
            parts = [p.strip().lower() for p in shortcut.split("+") if p.strip()]
            key, using = parts[-1], [mods[p] for p in parts[:-1] if p in mods]
            using_clause = f" using {{{', '.join(using)}}}" if using else ""
            action = f"key code {codes[key]}" if key in codes else f"keystroke {_as_string(key)}"
            _osascript(f'tell application "System Events" to {action}{using_clause}')
        return "Done."

    def t_clipboard(self, action, text=""):
        if action == "write":
            _run(["pbcopy"], input_text=text)
            return "Copied to clipboard."
        return _truncate(_run(["pbpaste"])[1], 20000) or "(clipboard is empty)"

    def t_system_control(self, action, value=""):
        if action == "volume":
            level = max(0, min(100, int(float(value or 50))))
            _osascript(f"set volume output volume {level}")
            return f"Volume {level}%."
        if action in ("mute", "unmute"):
            _osascript(f"set volume {'with' if action == 'mute' else 'without'} output muted")
            return action.capitalize() + "d."
        if action == "dark_mode":
            _osascript('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode')
            return "Toggled dark mode."
        if action == "lock":
            _osascript('tell application "System Events" to keystroke "q" using {control down, command down}')
            return "Locked."
        if action == "display_sleep":
            _run(["pmset", "displaysleepnow"])
            return "Display sleeping."
        if action == "notify":
            name = self.config["agent_name"]
            _osascript(f"display notification {_as_string(value)} with title {_as_string(name)}")
            return "Notification shown."
        if action == "battery":
            return _run(["pmset", "-g", "batt"])[1]
        if action == "wifi":
            return _run(["/bin/zsh", "-lc", "networksetup -getairportnetwork en0 || ipconfig getsummary en0 | grep ' SSID'"])[1]
        return "Unknown action."

    # ---- agent ---------------------------------------------------------------

    def t_set_timer(self, minutes, message):
        def fire():
            self.agent.announce(f"⏰ {message}")
            try:
                _osascript(f"display notification {_as_string(message)} with title \"Reminder\" sound name \"Glass\"")
            except RuntimeError:
                pass

        timer = threading.Timer(float(minutes) * 60, fire)
        timer.daemon = True
        timer.start()
        when = (dt.datetime.now() + dt.timedelta(minutes=float(minutes))).strftime("%I:%M %p")
        return f"Timer set for {when}. (It works while the agent app stays open.)"

    def t_update_user(self, message):
        self.agent.announce(message)
        return "Said it."

    def t_change_identity(self, **changes):
        changes = {k: v for k, v in changes.items() if v is not None}
        if "agent_name" in changes and "wake_word" not in changes:
            # By default the agent answers to its new name.
            changes["wake_word"] = changes["agent_name"]
        if "wake_word" in changes:
            aliases = {a.lower() for a in changes.get("wake_aliases", [])}
            aliases.add(changes["wake_word"].lower())
            changes["wake_aliases"] = sorted(aliases)
        self.config.update(**changes)
        if "voice" in changes:
            self.agent.speaker.refresh_voice()
        self.agent.push_settings()
        return "Saved: " + json.dumps(changes, ensure_ascii=False)

    def t_go_to_sleep(self):
        self.agent.sleep_after_reply = True
        return f"OK, after this reply I'll wait for the wake word '{self.config['wake_word']}'."

