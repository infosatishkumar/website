#!/usr/bin/env python3
"""Original soundtrack + sound design for the DigitalNgage showreel.

Everything is synthesised here (no samples, no licensing issues):
128 BPM, A minor, Am-F-C-G. Sound effects are placed from the cue list that
reel.js registers while it builds the animation, so every hit lands on the
same frame as the cut it belongs to.

    python3 music.py sfx.json out_dir

Writes music.wav, sfx.wav and mix.wav (48 kHz, 16-bit stereo).
"""
import json
import sys
import wave

import numpy as np

SR = 48000
BPM = 128
B = 60 / BPM
BAR = 4 * B
DUR = 60.0
N = int(SR * (DUR + 1.5))
rng = np.random.default_rng(128)


def at(bar, beat=0.0):
    return bar * BAR + beat * B


def idx(t):
    return int(round(t * SR))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, t, gain=1.0, pan=0.0):
    """Add a mono or stereo signal into the stereo buffer at time t."""
    i = idx(t)
    if i >= buf.shape[1]:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
    j = min(buf.shape[1], i + sig.shape[1])
    if i < 0:
        sig = sig[:, -i:]
        i = 0
    buf[:, i:j] += sig[:, : j - i] * gain


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def fft_band(x, lo=None, hi=None, soft=1.3):
    """Zero-phase band-limit by FFT with soft edges (lo/hi in Hz)."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** (4 * soft))
    if hi:
        m *= 1 / (1 + (f / hi) ** (4 * soft))
    return np.fft.irfft(X * m, n)


def sweep(x, f0, f1, width=0.9):
    """Time-varying band-pass (STFT), centre moves exponentially f0 -> f1."""
    win, hop = 2048, 512
    pad = np.concatenate([np.zeros(win), x, np.zeros(win)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    frames = (len(pad) - win) // hop + 1
    for k in range(frames):
        s = k * hop
        p = min(1, max(0, (s - win) / max(1, len(x))))
        fc = f0 * (f1 / f0) ** p
        m = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / width) ** 2)
        seg = np.fft.irfft(np.fft.rfft(pad[s:s + win] * w) * m, win)
        out[s:s + win] += seg * w
        norm[s:s + win] += w * w
    out /= np.maximum(norm, 1e-3)
    return out[win:win + len(x)]


def reverb_ir(dur=2.2, seed=0):
    r = np.random.default_rng(seed)
    t = tt(dur)
    irs = []
    for _ in range(2):
        n = r.standard_normal(len(t)) * np.exp(-t * 6.9 / dur)
        n = fft_band(n, 200, 9000)
        irs.append(n / np.sqrt(np.sum(n ** 2)))
    return np.vstack(irs)


def convolve_stereo(x, ir):
    n = x.shape[1] + ir.shape[1]
    size = 1 << (n - 1).bit_length()
    out = np.zeros((2, x.shape[1]))
    for c in range(2):
        y = np.fft.irfft(np.fft.rfft(x[c], size) * np.fft.rfft(ir[c], size), size)
        out[c] = y[: x.shape[1]]
    return out


def saw(freq, dur, cap=40, phase=0.0):
    t = tt(dur)
    k = np.arange(1, max(2, min(cap, int(16000 / freq))) + 1)[:, None]
    return (np.sin(2 * np.pi * k * freq * t[None, :] + phase * k) / k).sum(0) * (2 / np.pi)


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = n - a - d - r if hold is None else int(hold * SR)
    hold = max(0, hold)
    e = np.concatenate([np.linspace(0, 1, max(1, a)), np.linspace(1, s, max(1, d)), np.full(hold, s), np.linspace(s, 0, max(1, r))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


# ── instruments ──────────────────────────────────────────────

def kick(gain=1.0):
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7)
    click = fft_band(rng.standard_normal(len(t)), 1500, 8000) * np.exp(-t * 300) * 0.4
    return np.tanh((body + click) * 1.6) * gain


def clap():
    t = tt(0.35)
    n = fft_band(rng.standard_normal(len(t)), 900, 7000)
    e = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        e += (t >= off) * np.exp(-np.maximum(t - off, 0) * (60 if off < 0.02 else 18))
    return n * e * 0.55


def snare():
    t = tt(0.25)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    n = fft_band(rng.standard_normal(len(t)), 1200, 9000) * np.exp(-t * 22)
    return (tone + n) * 0.6


def hat(open_=False):
    d = 0.32 if open_ else 0.05
    t = tt(d)
    n = fft_band(rng.standard_normal(len(t)), 7000, None)
    return n * np.exp(-t * (9 if open_ else 80)) * (0.24 if open_ else 0.19)


def crash(dur=2.0):
    t = tt(dur)
    n = fft_band(rng.standard_normal(len(t)), 4000, None)
    return n * np.exp(-t * 2.2) * 0.45


CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]  # Am F C G
ROOTS = [33, 29, 36, 31]
ARPS = [[69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79]]

_cache = {}


def supersaw(notes, dur, voices=5, cap=18):
    key = ("ss", tuple(notes), dur)
    if key in _cache:
        return _cache[key]
    L = np.zeros(int(dur * SR))
    R = np.zeros_like(L)
    for m in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 0.11
            s = saw(mtof(m + det), dur, cap, phase=rng.random() * 6.28)
            if v % 2:
                L += s
            else:
                R += s
    out = np.vstack([L, R]) / (len(notes) * voices) * 2.2
    _cache[key] = out
    return out


def bass_note(m, dur):
    key = ("b", m, dur)
    if key not in _cache:
        s = saw(mtof(m), dur, 24) * 0.7 + np.sin(2 * np.pi * mtof(m) * tt(dur)) * 0.8
        _cache[key] = np.tanh(s * 1.4) * adsr(len(s), 0.004, 0.08, 0.7, 0.03)
    return _cache[key]


def pluck(m, dur=0.22):
    key = ("p", m)
    if key not in _cache:
        t = tt(dur)
        s = saw(mtof(m), dur, 10) * np.exp(-t * 14)
        _cache[key] = s * 0.5
    return _cache[key]


def lead(m, dur):
    t = tt(dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 4, 0, 1)
    ph = 2 * np.pi * np.cumsum(mtof(m) * vib) / SR
    k = np.arange(1, 14)[:, None]
    s = (np.sin(k * ph[None, :]) / k).sum(0)
    return s * adsr(len(t), 0.01, 0.1, 0.75, 0.08) * 0.32


def pad(notes, dur):
    t = tt(dur)
    L = np.zeros(len(t))
    R = np.zeros(len(t))
    for i, m in enumerate(notes):
        for d, ch in ((-0.07, L), (0.07, R)):
            ch += saw(mtof(m + d), dur, 6, phase=i + d)
    e = adsr(len(t), 0.6, 0.2, 0.9, 0.6)
    return np.vstack([L * e, R * e]) * 0.12


# ── sound effects ─────────────────────────────────────────────

def sfx_impact(final=False):
    d = 3.0 if final else 2.0
    t = tt(d)
    f = 28 + 50 * np.exp(-t * 3)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (1.2 if final else 2.0))
    boom = fft_band(rng.standard_normal(len(t)), None, 2500) * np.exp(-t * 7) * 0.9
    cr = fft_band(rng.standard_normal(len(t)), 3500, None) * np.exp(-t * 1.8) * 0.35
    return np.tanh((sub * 1.3 + boom + cr) * 1.2) * 0.9


def sfx_hit(short=False):
    t = tt(0.5)
    f = 42 + 120 * np.exp(-t * 35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (14 if short else 8))
    n = fft_band(rng.standard_normal(len(t)), 900, 8000) * np.exp(-t * 26) * 0.6
    return np.tanh((body + n) * 1.5) * (0.6 if short else 0.85)


def sfx_whoosh(dur=0.5, f0=250, f1=7000):
    n = rng.standard_normal(int(dur * SR))
    s = sweep(n, f0, f1, 0.8)
    e = np.sin(np.linspace(0, np.pi, len(s))) ** 1.6
    s = s * e
    pan = np.linspace(-0.8, 0.8, len(s))
    return np.vstack([s * np.cos((pan + 1) * np.pi / 4), s * np.sin((pan + 1) * np.pi / 4)]) * 1.6


def sfx_riser(dur):
    t = tt(dur)
    n = sweep(rng.standard_normal(len(t)), 300, 11000, 1.0)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (3 * t / dur)) / SR) * 0.25
    e = (t / dur) ** 2.4
    return (n * 1.2 + tone) * e * 0.8


def sfx_reverse(dur):
    return crash(dur)[::-1] * 1.2


def sfx_tick():
    t = tt(0.02)
    return np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 300) * 0.5


def sfx_pop(pitch=1.0):
    t = tt(0.09)
    f = (500 + 700 * (1 - np.exp(-t * 60))) * pitch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40) * 0.6


def sfx_blip(pitch=1.0):
    t = tt(0.06)
    return np.sign(np.sin(2 * np.pi * 1100 * pitch * t)) * np.exp(-t * 60) * 0.18


def sfx_click():
    t = tt(0.03)
    return fft_band(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 220) * 0.9


def sfx_shutter():
    out = np.zeros(int(0.2 * SR))
    for off, g in ((0, 1.0), (0.07, 0.7)):
        t = tt(0.05)
        c = fft_band(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t * 160) * g
        i = idx(off)
        out[i:i + len(c)] += c
    return out * 0.9


def sfx_glitch():
    t = tt(0.16)
    sq = np.sign(np.sin(2 * np.pi * 95 * t)) * 0.3
    gate = (rng.random(len(t) // 400 + 1) > 0.4).repeat(400)[: len(t)]
    crush = np.round(rng.standard_normal(len(t)) * 3) / 6
    return (sq + crush) * gate * 0.5


def sfx_type(dur):
    out = np.zeros(int(dur * SR) + SR // 10)
    tpos = 0.0
    while tpos < dur:
        c = sfx_click() * (0.4 + 0.3 * rng.random())
        i = idx(tpos)
        out[i:i + len(c)] += c
        tpos += 0.035 + rng.random() * 0.04
    return out * 0.7


def sfx_scroll(dur):
    s = sfx_whoosh(dur, 400, 2500)[0] * 0.5
    tpos = 0.0
    while tpos < dur - 0.02:
        c = sfx_tick() * 0.25
        i = idx(tpos)
        s[i:i + len(c)] += c
        tpos += 0.045
    return s


# ── arrangement ───────────────────────────────────────────────

def build_music():
    drums = np.zeros((2, N))
    synth = np.zeros((2, N))
    bassb = np.zeros((2, N))
    kicks = []

    def k(t, g=1.0):
        place(drums, kick(g), t)
        kicks.append(t)

    groove = range(4, 28)
    fills = {11, 16, 21, 24, 27}
    for bar in range(32):
        ch = bar % 4
        # intro: pad + rising arp
        if bar < 2:
            place(synth, pad(CHORDS[ch], BAR + 0.6), at(bar), 0.9)
            for s in range(16):
                g = 0.15 + 0.5 * (bar * 16 + s) / 32
                place(synth, pluck(ARPS[ch][s % 4]), at(bar, s / 4), g, pan=(-0.4 if s % 2 else 0.4))
        # kinetic: four-on-the-floor builds, snare roll into the drop
        if bar in (2, 3):
            for b in range(4):
                k(at(bar, b), 0.9)
            for s in range(16):
                place(synth, pluck(ARPS[ch][s % 4]), at(bar, s / 4), 0.45, pan=(-0.4 if s % 2 else 0.4))
            place(synth, pad(CHORDS[ch], BAR + 0.6), at(bar), 0.8)
            if bar == 3:
                for s in range(16):
                    if s >= 8 or s % 2 == 0:
                        place(drums, snare(), at(bar, s / 4), 0.25 + 0.6 * s / 16)
        if bar in groove:
            last_two_off = bar in fills
            for b in range(4):
                if not (last_two_off and b >= 2):
                    k(at(bar, b))
                if b in (1, 3):
                    place(drums, clap(), at(bar, b), 0.9)
                place(drums, hat(True), at(bar, b + 0.5), 0.7, pan=0.3)
            for s in range(16):
                vel = (0.8 if s % 2 == 0 else 0.45) * (0.6 if s % 4 == 0 else 1)
                place(drums, hat(), at(bar, s / 4), vel, pan=-0.35 + 0.1 * (s % 3))
            if last_two_off:
                for s in range(8, 16):
                    place(drums, snare(), at(bar, s / 4), 0.3 + 0.7 * (s - 8) / 8)
            # bass: pumping eighths
            for e in range(8):
                if last_two_off and e >= 4:
                    break
                m = ROOTS[ch] + (12 if e in (3, 7) else 0)
                place(bassb, bass_note(m, B / 2 * 0.92), at(bar, e / 2), 0.55)
            # stabs on a syncopated grid
            for s in (0, 3, 6, 10, 12):
                place(synth, supersaw(CHORDS[ch], 0.22) * adsr(int(0.22 * SR), 0.003, 0.05, 0.5, 0.12), at(bar, s / 4), 0.5)
            # sparkle arp
            for s in range(16):
                place(synth, pluck(ARPS[ch][(s * 3) % 4] + 12), at(bar, s / 4), 0.16, pan=(-0.6 if s % 2 else 0.6))
        # climax lead over the client numbers
        if 25 <= bar <= 27:
            mel = [[76, 74, 76, 79, 81, 79, 76, 74], [77, 76, 74, 72, 74, 76, 77, 76], [79, 76, 74, 76, 79, 81, 83, 84]][bar - 25]
            for e, m in enumerate(mel):
                place(synth, lead(m, B / 2 * 0.9), at(bar, e / 2), 0.5, pan=0.1)
        # outro
        if bar in (28, 29):
            for b in range(4):
                k(at(bar, b))
                place(drums, hat(True), at(bar, b + 0.5), 0.6, pan=0.3)
                if b in (1, 3):
                    place(drums, clap(), at(bar, b), 0.8)
            place(synth, supersaw(CHORDS[ch], BAR) * adsr(int(BAR * SR), 0.01, 0.4, 0.55, 0.3), at(bar), 0.55)
            for e in range(8):
                place(bassb, bass_note(ROOTS[ch], B / 2 * 0.92), at(bar, e / 2), 0.5)
        if bar == 30:
            place(synth, pad([57, 60, 64, 69], BAR * 2 + 1), at(bar), 1.3)
            for s in range(16):
                place(synth, pluck(ARPS[0][s % 4] + 12), at(bar, s / 4), 0.35 * (1 - s / 20), pan=(-0.5 if s % 2 else 0.5))
        if bar == 31:
            k(at(bar), 1.1)
            place(synth, supersaw([45, 57, 60, 64, 69], 2.6) * adsr(int(2.6 * SR), 0.005, 0.5, 0.45, 1.6), at(bar), 0.8)
            place(bassb, bass_note(33, 1.6), at(bar), 0.6)
            place(drums, crash(3.0), at(bar), 0.9)
    for bar in (4, 8, 12, 17, 22, 25, 28):
        place(drums, crash(2.0), at(bar), 0.8)

    # sidechain pump on everything except drums
    t = np.arange(N) / SR
    sc = np.ones(N)
    for kt in kicks:
        i = idx(kt)
        seg = t[i:i + int(0.3 * SR)] - kt
        sc[i:i + len(seg)] = np.minimum(sc[i:i + len(seg)], 1 - 0.78 * np.exp(-seg / 0.075))
    synth *= sc
    bassb *= sc
    bassb = np.vstack([fft_band(bassb[0], 30, 2200), fft_band(bassb[1], 30, 2200)])

    # Haas widening on the synth bus
    d = int(0.012 * SR)
    synth[1] = np.concatenate([np.zeros(d), synth[1][:-d]])
    ir = reverb_ir(2.4, 1)
    wet = convolve_stereo(synth * 0.5 + drums * 0.08, ir)
    return drums * 0.85 + synth * 0.8 + bassb * 0.9 + wet * 0.35


def build_sfx(cues):
    out = np.zeros((2, N))
    for c in cues:
        typ, t, g = c["type"], c["t"], c.get("gain", 1.0)
        if typ == "impact":
            place(out, sfx_impact(c.get("final", False)), t, 0.9 * g)
        elif typ == "hit":
            place(out, sfx_hit(c.get("short", False)), t, 0.7 * g)
        elif typ == "whoosh":
            place(out, sfx_whoosh(c.get("dur", 0.5)), t - c.get("dur", 0.5) * 0.45, 0.5 * g)
        elif typ == "swish":
            d = 0.16 if c.get("short") else 0.24
            place(out, sfx_whoosh(d, 1500, 9500), t - d * 0.4, 0.38 * g)
        elif typ == "sweep":
            place(out, sfx_whoosh(c["dur"], 300, 5000), t, 0.4 * g)
        elif typ == "riser":
            place(out, sfx_riser(c["dur"]), t, 0.32 * g, pan=0)
        elif typ == "reverse":
            place(out, sfx_reverse(c["dur"]), t, 0.5 * g)
        elif typ == "tick":
            place(out, sfx_tick(), t, 0.5 * g, pan=0.2)
        elif typ == "pop":
            place(out, sfx_pop(c.get("pitch", 1.0)), t, 0.5 * g, pan=rng.uniform(-0.5, 0.5))
        elif typ == "blip":
            place(out, sfx_blip(c.get("pitch", 1.0)), t, 0.6 * g, pan=rng.uniform(-0.4, 0.4))
        elif typ == "click":
            place(out, sfx_click(), t, 0.5 * g, pan=rng.uniform(-0.3, 0.3))
        elif typ == "shutter":
            place(out, sfx_shutter(), t, 0.6 * g, pan=rng.uniform(-0.3, 0.3))
        elif typ == "glitch":
            place(out, sfx_glitch(), t, 0.5 * g)
        elif typ == "type":
            place(out, sfx_type(c["dur"]), t, 0.5 * g, pan=0.1)
        elif typ == "scroll":
            place(out, sfx_scroll(c["dur"]), t, 0.6 * g)
    ir = reverb_ir(1.6, 2)
    return out + convolve_stereo(out, ir) * 0.12


def master(x, ceiling=0.89):
    x = x - x.mean(axis=1, keepdims=True)
    x = np.vstack([fft_band(x[0], 25, 15500, 0.8), fft_band(x[1], 25, 15500, 0.8)])
    peak = np.max(np.abs(x))
    x = np.tanh(x / peak * 1.6) / np.tanh(1.6)
    x *= ceiling / np.max(np.abs(x))
    n = int(DUR * SR)
    x = x[:, :n]
    fade = int(1.1 * SR)  # matches the video fade to black
    x[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    return x


def write_wav(path, x):
    y = (np.clip(x, -1, 1) * 32767).astype("<i2").T.copy()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def main():
    cues = json.load(open(sys.argv[1]))["sfx"]
    out = sys.argv[2]
    music = build_music()
    fx = build_sfx(cues)
    # stems normalised separately so a voice-over can be mixed later
    write_wav(f"{out}/music.wav", master(music.copy(), 0.8))
    write_wav(f"{out}/sfx.wav", master(fx.copy(), 0.8))
    mix = music / np.max(np.abs(music)) * 0.62 + fx / np.max(np.abs(fx)) * 0.55
    write_wav(f"{out}/mix.wav", master(mix))
    print("wrote", out)


if __name__ == "__main__":
    main()
