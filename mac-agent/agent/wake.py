"""Wake-word detection on top of the speech-to-text transcript.

Any name works as a wake word (Karishma, Satish, Jarvis...) because we match the
transcribed text instead of using a fixed audio model. Matching is fuzzy so small
recognition mistakes ("krishma", "charisma") still wake the agent.
"""

import difflib
import re

_WORD = re.compile(r"[\wऀ-ॿ]+", re.UNICODE)
_GREETINGS = {"hey", "hi", "hello", "ok", "okay", "o", "arey", "are", "arre", "suno", "oye", "hii"}


def _norm(text):
    return [w.lower() for w in _WORD.findall(text or "")]


def _candidates(wake_word, aliases):
    words = {w.lower().strip() for w in [wake_word, *(aliases or [])] if w and w.strip()}
    return [w.split() for w in words]


def find_wake_word(text, wake_word, aliases=()):
    """Return the command spoken after the wake word, or None if not woken.

    "Karishma chrome kholo" -> "chrome kholo"
    "hey karishma"          -> ""   (woken, no command yet)
    "kuch aur baat"         -> None
    """
    words = _norm(text)
    if not words:
        return None
    for cand in _candidates(wake_word, aliases):
        n = len(cand)
        target = " ".join(cand)
        for i in range(len(words) - n + 1):
            chunk = " ".join(words[i : i + n])
            ratio = difflib.SequenceMatcher(None, chunk, target).ratio()
            # Short names need a stricter match to avoid false wake-ups.
            threshold = 0.9 if len(target) <= 4 else 0.78
            if ratio >= threshold:
                # Only accept the wake word near the start of the sentence
                # (allowing a greeting like "hey" / "ok" before it).
                prefix = [w for w in words[:i] if w not in _GREETINGS]
                if len(prefix) > 2:
                    continue
                return _rest_of_text(text, i + n)
    return None


def _rest_of_text(original, word_index):
    matches = list(_WORD.finditer(original))
    if word_index >= len(matches):
        return ""
    return original[matches[word_index].start():].strip(" ,.!?")


if __name__ == "__main__":
    tests = [
        ("Karishma chrome kholo", "Karishma"),
        ("hey krishma", "Karishma"),
        ("charisma what is the time", "Karishma"),
        ("aaj mausam kaisa hai", "Karishma"),
        ("Satish youtube chalao", "Satish"),
    ]
    for text, wake in tests:
        print(repr(text), "->", repr(find_wake_word(text, wake, ["charisma"])))
