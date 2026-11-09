"""Instant answers for everyday commands - no AI call, so they happen in a fraction of a second.

Anything not matched here goes to the brain (Claude / other provider) as usual.
"""

from __future__ import annotations

import re
import subprocess
from datetime import datetime
from typing import Callable

WEBSITES = {
    "youtube": "https://www.youtube.com", "google": "https://www.google.com", "gmail": "https://mail.google.com",
    "instagram": "https://www.instagram.com", "facebook": "https://www.facebook.com", "linkedin": "https://www.linkedin.com",
    "twitter": "https://x.com", "x": "https://x.com", "amazon": "https://www.amazon.in", "flipkart": "https://www.flipkart.com",
    "irctc": "https://www.irctc.co.in", "makemytrip": "https://www.makemytrip.com", "swiggy": "https://www.swiggy.com",
    "zomato": "https://www.zomato.com", "netflix": "https://www.netflix.com", "chatgpt": "https://chatgpt.com",
    "claude": "https://claude.ai", "maps": "https://maps.google.com", "google maps": "https://maps.google.com",
    "drive": "https://drive.google.com", "google drive": "https://drive.google.com", "canva": "https://www.canva.com",
    "whatsapp web": "https://web.whatsapp.com", "bookmyshow": "https://in.bookmyshow.com",
}
APPS = {
    "chrome": "Google Chrome", "google chrome": "Google Chrome", "safari": "Safari", "whatsapp": "WhatsApp",
    "spotify": "Spotify", "music": "Music", "notes": "Notes", "calculator": "Calculator", "calendar": "Calendar",
    "settings": "System Settings", "system settings": "System Settings", "finder": "Finder", "terminal": "Terminal",
    "photoshop": "Adobe Photoshop 2026", "illustrator": "Adobe Illustrator 2026", "premiere": "Adobe Premiere Pro 2026",
    "after effects": "Adobe After Effects 2026", "canva app": "Canva", "mail": "Mail", "messages": "Messages",
    "facetime": "FaceTime", "photos": "Photos", "reminders": "Reminders", "app store": "App Store",
    "vs code": "Visual Studio Code", "claude app": "Claude", "chatgpt app": "ChatGPT",
}
OPEN = re.compile(r"^(?:please\s+)?(.+?)\s+(?:kholo|khol do|khol|open karo|open kar do|open|chalao|chala do|start karo|launch karo)\W*$|"
                  r"^(?:open|launch)\s+(.+?)\W*$", re.I)
VOL_SET = re.compile(r"volume\s+(\d{1,3})(?:\s*%|\s*percent)?", re.I)
VOL_UP = re.compile(r"volume\s+(badhao|badha do|tez karo|up|increase|zyada)", re.I)
VOL_DOWN = re.compile(r"volume\s+(kam karo|kam kar do|ghatao|down|decrease|dheere)", re.I)
MUTE = re.compile(r"^(mute( karo)?|awaaz band( karo)?|sound band( karo)?)\W*$", re.I)
UNMUTE = re.compile(r"^(unmute( karo)?|awaaz chalu( karo)?|sound on( karo)?)\W*$", re.I)
TIME = re.compile(r"(time|samay|baje|टाइम|समय).*(kya|kitne|hai|batao|hua)|what('?s| is) the time", re.I)
DATE = re.compile(r"(date|tareekh|tarikh|aaj kaun sa din|din kya hai|तारीख)", re.I)


def handle(text: str, run: Callable[[list[str]], None] | None = None) -> str | None:
    """Return a short spoken reply if the command was done instantly, else None."""
    run = run or (lambda args: subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    t = text.strip().rstrip(".!?। ").lower()
    if len(t.split()) > 7:  # long sentences need real understanding
        return None

    m = VOL_SET.search(t)
    if m:
        v = max(0, min(100, int(m.group(1))))
        run(["osascript", "-e", f"set volume output volume {v}"])
        return f"Volume {v} kar diya."
    if VOL_UP.search(t):
        run(["osascript", "-e", "set volume output volume ((output volume of (get volume settings)) + 15)"])
        return "Volume badha diya."
    if VOL_DOWN.search(t):
        run(["osascript", "-e", "set volume output volume ((output volume of (get volume settings)) - 15)"])
        return "Volume kam kar diya."
    if MUTE.match(t):
        run(["osascript", "-e", "set volume output muted true"])
        return "Mute kar diya."
    if UNMUTE.match(t):
        run(["osascript", "-e", "set volume output muted false"])
        return "Awaaz chalu kar di."

    m = OPEN.match(t)
    if m:
        name = (m.group(1) or m.group(2) or "").strip()
        name = re.sub(r"^(mera|meri|mere|the|ek)\s+", "", name)
        name = re.sub(r"\s+(app|website|site)$", "", name)
        if name in WEBSITES:
            run(["open", WEBSITES[name]])
            return f"{name.title()} khol diya."
        if name in APPS:
            run(["open", "-a", APPS[name]])
            return f"{name.title()} khol diya."
        return None  # unknown -> let the brain figure it out

    if len(t.split()) <= 5 and TIME.search(t) and not DATE.search(t):
        return "Abhi " + datetime.now().strftime("%-I:%M") + " baje hain."
    if len(t.split()) <= 5 and DATE.search(t):
        return "Aaj " + datetime.now().strftime("%A, %-d %B %Y") + " hai."
    return None
