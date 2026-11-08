"""Deciding what to do with what the microphone heard (no UI code - easy to test)."""

from __future__ import annotations

import re

from .main import STOP_WORDS, contains_wake_word
from .voice import NO_WORDS, YES_WORDS

HUSH = re.compile(r"^\W*(ruko|ruk ja|ruk jao|bas|bas karo|chup|stop|wait|ek minute)\W*$", re.I)


def route(heard: str, cfg, *, over_voice: bool, near_voice: bool, speakers: bool, said: str,
          waiting_answer: bool, awake: bool, busy: bool) -> tuple[str, str]:
    """Decide what to do with something the microphone heard.

    Returns (action, text) with action one of:
      ignore  - noise / Karishma's own echo / not meant for her
      answer  - reply to a question a tool asked (haan/nahi, details)
      wake    - only the wake word was said
      hush    - "ruko", "bas" ... stop talking and stop the current job
      bye     - go back to sleep (wake word needed again)
      command - a new request (replaces whatever she was doing)
    """
    heard = (heard or "").strip()
    if not heard:
        return "ignore", ""
    # 0. she asked a question and is still reading it -> "haan"/"nahi" answers it right away
    if (waiting_answer and (YES_WORDS.search(heard) or NO_WORDS.search(heard)) and len(heard.split()) <= 6
            and not re.search(r"haan\W+ya\W+nahi", heard, re.I)):   # that's her own question echoing
        return "answer", heard
    # 1. her own voice coming back through the mic
    if near_voice and said and _is_echo(heard, said):
        return "ignore", ""
    after_wake = contains_wake_word(heard, cfg)       # None = no wake word
    request = after_wake if after_wake else heard
    # 2. while she talks on laptop speakers, only "Karishma …" or "ruko/bas" can interrupt
    if over_voice and speakers and after_wake is None and not HUSH.match(heard):
        return "ignore", ""
    if HUSH.match(request):
        return "hush", request
    # 3. a tool is waiting for an answer
    if waiting_answer:
        return "answer", request
    # 4. sleeping: need the wake word
    if not (awake or busy or over_voice):
        if after_wake is None:
            return "ignore", ""
        if not after_wake:
            return "wake", ""
    elif after_wake == "":
        return "wake", ""
    if STOP_WORDS.search(request):
        return "bye", request
    # 5. while she's busy, ignore stray one-word noises ("hmm", "ok") unless addressed to her
    if busy and after_wake is None and len(request.split()) < 2:
        return "ignore", ""
    return "command", request

def _is_echo(heard: str, said: str) -> bool:
    """True if what the mic heard is mostly Karishma's own sentence (speaker echo)."""
    h = {w.strip(".,!?।") for w in heard.lower().split() if len(w) > 2}
    if len(h) < 2:
        return False
    s = {w.strip(".,!?।") for w in said.lower().split() if len(w) > 2}
    if len(h) <= 3:  # short phrases: only an exact echo counts
        return h <= s
    return len(h & s) / len(h) >= 0.5
