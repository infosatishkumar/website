#!/usr/bin/env python3
"""Generate the showreel voice-over lines with ElevenLabs.

    ELEVENLABS_API_KEY=... python3 tts.py out_dir

Reads the API key from the environment only (never hard-code it).
Writes vo-01.mp3 … vo-09.mp3, one file per line in LINES.
"""
import json
import os
import sys
import urllib.request

VOICE_ID = "cgSgspJ2msm6clMCkdW9"
MODEL = "eleven_multilingual_v2"

# (start time in seconds, text) — keep in sync with voiceover-script.md
LINES = [
    (0.4, "Your brand deserves more than likes."),
    (4.0, "Meet DigitalNgage. Strategy, creative and code — under one roof."),
    (8.0, "Social media. Meta and Google ads. SEO. Websites. E-commerce. Apps. And custom CRM software."),
    (15.3, "We design websites that move — and convert."),
    (22.8, "For KIO Organics, we built a premium online store. Eight ways to pay, every payment verified — plus the social media and ads that drive the sales."),
    (32.2, "For Metro Puf Industries, a custom CRM that turns every enquiry into a follow-up. Over six thousand leads, in one place."),
    (41.5, "And our own website? Rebuilt from the ground up."),
    (47.2, "Seven-plus brands. One hundred percent retention."),
    (52.8, "DigitalNgage. Let's grow your brand. Book your free audit today."),
]


def main():
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY in the environment first.")
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for i, (_, text) in enumerate(LINES, 1):
        body = json.dumps({
            "text": text,
            "model_id": MODEL,
            "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
        }).encode()
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_192",
            data=body, headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        with urllib.request.urlopen(req) as r, open(f"{out}/vo-{i:02d}.mp3", "wb") as f:
            f.write(r.read())
        print("wrote", f"vo-{i:02d}.mp3")


if __name__ == "__main__":
    main()
