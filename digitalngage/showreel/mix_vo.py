#!/usr/bin/env python3
"""Mix the voice-over into the showreel soundtrack.

    python3 mix_vo.py audio_dir vo_dir out.wav

audio_dir holds music.wav and sfx.wav from music.py. vo_dir holds either
vo-01.mp3 … vo-09.mp3 (one per line, placed at the cue times in tts.py) or a
single vo-full.mp3 that starts at 0:00. Music is ducked under the voice.
Needs ffmpeg on PATH to decode mp3.
"""
import os
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts import LINES  # noqa: E402

SR = 48000


def read_wav(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).T / 32768.0


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, "<i2").reshape(-1, 2).T / 32768.0


def main():
    adir, vdir, out = sys.argv[1:4]
    music, fx = read_wav(f"{adir}/music.wav"), read_wav(f"{adir}/sfx.wav")
    n = music.shape[1]
    vo = np.zeros((2, n))
    full = os.path.join(vdir, "vo-full.mp3")
    clips = [(0.0, full)] if os.path.exists(full) else [(t, os.path.join(vdir, f"vo-{i:02d}.mp3")) for i, (t, _) in enumerate(LINES, 1)]
    for t, p in clips:
        if not os.path.exists(p):
            print("missing", p)
            continue
        v = decode(p)
        i = int(t * SR)
        j = min(n, i + v.shape[1])
        vo[:, i:j] += v[:, : j - i]
    vo /= max(1e-6, np.max(np.abs(vo)))

    # sidechain duck: follow the voice envelope (fast attack, slow release)
    env = np.abs(vo).max(0)
    win = int(0.03 * SR)
    env = np.convolve(env, np.ones(win) / win, "same")
    duck = np.zeros(n)
    g = 0.0
    rel = np.exp(-1 / (0.35 * SR))
    for k in range(0, n, 64):
        target = min(1.0, env[k] * 6)
        g = target if target > g else g * rel ** 64
        duck[k:k + 64] = g
    music_g = 1 - 0.6 * duck          # about -8 dB under the voice
    fx_g = 1 - 0.35 * duck

    mix = music * music_g * 0.55 + fx * fx_g * 0.45 + vo * 0.8
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix *= 0.89 / np.max(np.abs(mix))
    y = (mix.T * 32767).astype("<i2")
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())
    print("wrote", out)


if __name__ == "__main__":
    main()
