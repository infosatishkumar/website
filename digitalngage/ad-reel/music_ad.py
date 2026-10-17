#!/usr/bin/env python3
"""Soundtrack, sound design and final mix for the DigitalNgage ad reel.

Reuses the synth instruments from ../showreel/music.py (all synthesised, no
samples). 128 BPM, Am-F-C-G. The music grid is shifted so the first drop lands
on "Not anymore!" and the last drop on the CTA. Sound effects come from the cue
list ad.js registers; the voice-over is ducked over the music.

    python3 music_ad.py sfx.json vo.mp3 out_dir

Writes music.wav, sfx.wav and mix.wav (48 kHz, 16-bit stereo).
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "showreel"))
import music as M  # noqa: E402

SR, B, BAR = M.SR, M.B, M.BAR
DUR = 33.6           # must match ad.js
VO_OFF = 0.3         # must match ad.js OFF
DROP1 = 2.28         # "Not anymore!" on the video clock
MOFF = DROP1 - BAR   # music bar 1 lands on DROP1
M.DUR = DUR
M.N = N = int(SR * (DUR + 1.5))


def build_music():
    n = int(SR * (DUR + 3))
    drums, synth, bassb = np.zeros((2, n)), np.zeros((2, n)), np.zeros((2, n))
    place, at = M.place, M.at
    kicks = []

    def k(t, g=1.0):
        place(drums, M.kick(g), t)
        kicks.append(t)

    def groove(bar, fill=False, lead=None):
        ch = bar % 4
        for b in range(4):
            if not (fill and b >= 2):
                k(at(bar, b))
            if b in (1, 3):
                place(drums, M.clap(), at(bar, b), 0.9)
            place(drums, M.hat(True), at(bar, b + 0.5), 0.7, pan=0.3)
        for s in range(16):
            vel = (0.8 if s % 2 == 0 else 0.45) * (0.6 if s % 4 == 0 else 1)
            place(drums, M.hat(), at(bar, s / 4), vel, pan=-0.35 + 0.1 * (s % 3))
        if fill:
            for s in range(8, 16):
                place(drums, M.snare(), at(bar, s / 4), 0.3 + 0.7 * (s - 8) / 8)
        for e in range(8):
            if fill and e >= 4:
                break
            m = M.ROOTS[ch] + (12 if e in (3, 7) else 0)
            place(bassb, M.bass_note(m, B / 2 * 0.92), at(bar, e / 2), 0.55)
        for s in (0, 3, 6, 10, 12):
            place(synth, M.supersaw(M.CHORDS[ch], 0.22) * M.adsr(int(0.22 * SR), 0.003, 0.05, 0.5, 0.12), at(bar, s / 4), 0.5)
        for s in range(16):
            place(synth, M.pluck(M.ARPS[ch][(s * 3) % 4] + 12), at(bar, s / 4), 0.16, pan=(-0.6 if s % 2 else 0.6))
        if lead:
            for e, m in enumerate(lead):
                place(synth, M.lead(m, B / 2 * 0.9), at(bar, e / 2), 0.45, pan=0.1)

    # bar 0: intro under the hook — pad + rising arp
    place(synth, M.pad(M.CHORDS[0], BAR + 0.6), at(0), 0.9)
    for s in range(16):
        place(synth, M.pluck(M.ARPS[0][s % 4]), at(0, s / 4), 0.15 + 0.4 * s / 16, pan=(-0.4 if s % 2 else 0.4))
    for s in range(8, 16):
        place(drums, M.snare(), at(0, s / 4), 0.2 + 0.6 * (s - 8) / 8)
    # bars 1-13: the drive (services, case studies, clients)
    for bar in range(1, 14):
        groove(bar, fill=bar in (6, 13))
    # bar 14: breakdown under "Your brand... could be next."
    place(synth, M.pad([57, 60, 64, 69], BAR + 0.8), at(14), 1.2)
    for s in range(16):
        place(synth, M.pluck(M.ARPS[1][s % 4] + 12), at(14, s / 4), 0.25 + 0.25 * s / 16, pan=(-0.5 if s % 2 else 0.5))
    for s in range(16):
        if s >= 8 or s % 2 == 0:
            place(drums, M.snare(), at(14, s / 4), 0.2 + 0.6 * s / 16)
    # bars 15-16: CTA drop with a lead hook
    groove(15, lead=[76, 74, 76, 79, 81, 79, 76, 74])
    groove(16, lead=[79, 76, 74, 76, 79, 81, 83, 84])
    # bar 17: final chord
    k(at(17), 1.1)
    place(synth, M.supersaw([45, 57, 60, 64, 69], 2.6) * M.adsr(int(2.6 * SR), 0.005, 0.5, 0.45, 1.6), at(17), 0.8)
    place(bassb, M.bass_note(33, 1.6), at(17), 0.6)
    place(drums, M.crash(3.0), at(17), 0.9)
    for bar in (1, 5, 7, 11, 15):
        place(drums, M.crash(2.0), at(bar), 0.8)

    t = np.arange(n) / SR
    sc = np.ones(n)
    for kt in kicks:
        i = int(kt * SR)
        seg = t[i:i + int(0.3 * SR)] - kt
        sc[i:i + len(seg)] = np.minimum(sc[i:i + len(seg)], 1 - 0.78 * np.exp(-seg / 0.075))
    synth *= sc
    bassb *= sc
    bassb = np.vstack([M.fft_band(bassb[0], 30, 2200), M.fft_band(bassb[1], 30, 2200)])
    d = int(0.012 * SR)
    synth[1] = np.concatenate([np.zeros(d), synth[1][:-d]])
    wet = M.convolve_stereo(synth * 0.5 + drums * 0.08, M.reverb_ir(2.4, 1))
    mus = drums * 0.85 + synth * 0.8 + bassb * 0.9 + wet[:, :n] * 0.35
    # shift onto the video clock
    out = np.zeros((2, N))
    i0 = int(MOFF * SR)
    out[:, i0:] = mus[:, : N - i0]
    return out


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, "<i2").reshape(-1, 2).T / 32768.0


def main():
    cues = json.load(open(sys.argv[1]))["sfx"]
    vo_path, out = sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    music = build_music()
    fx = M.build_sfx(cues)[:, :N]
    M.write_wav(f"{out}/music.wav", M.master(music.copy(), 0.8))
    M.write_wav(f"{out}/sfx.wav", M.master(fx.copy(), 0.8))

    vo = np.zeros((2, N))
    v = decode(vo_path)
    i = int(VO_OFF * SR)
    j = min(N, i + v.shape[1])
    vo[:, i:j] = v[:, : j - i]
    vo /= max(1e-6, np.max(np.abs(vo)))
    # gentle presence boost on the voice (2-5 kHz) so it cuts through on phone speakers
    pres = np.vstack([M.fft_band(vo[0], 2000, 5000), M.fft_band(vo[1], 2000, 5000)])
    vo = vo + pres * 0.35
    vo /= np.max(np.abs(vo))

    env = np.abs(vo).max(0)
    win = int(0.03 * SR)
    env = np.convolve(env, np.ones(win) / win, "same")
    duck = np.zeros(N)
    g, rel = 0.0, np.exp(-1 / (0.3 * SR))
    for kk in range(0, N, 64):
        target = min(1.0, env[kk] * 6)
        g = target if target > g else g * rel ** 64
        duck[kk:kk + 64] = g
    m = music / np.max(np.abs(music))
    f = fx / np.max(np.abs(fx))
    mix = m * (1 - 0.62 * duck) * 0.55 + f * (1 - 0.3 * duck) * 0.5 + vo * 0.85
    M.write_wav(f"{out}/mix.wav", M.master(mix, 0.93))
    print("wrote", out)


if __name__ == "__main__":
    main()
