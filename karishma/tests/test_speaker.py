"""Owner voice recognition (numpy port of the Resemblyzer encoder)."""

from __future__ import annotations

import sys
import types

import numpy as np
import pytest

from karishma.speaker import VoiceProfile, encoder, mel_filterbank, mel_frames

SR = 16000


def voice(f0: float, formants: tuple[float, ...], seconds: float = 2.5, seed: int = 0) -> np.ndarray:
    """Crude synthetic 'speaker': harmonics with vibrato shaped by formant peaks + a little noise."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * SR)) / SR
    f = f0 * (1 + 0.04 * np.sin(2 * np.pi * (3 + seed) * t) + 0.02 * np.sin(2 * np.pi * 0.7 * t + seed))
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = np.zeros_like(t)
    for k in range(1, 40):
        hk = k * f
        amp = sum(np.exp(-((hk - F) / 120.0) ** 2) for F in formants) + 0.02
        sig += amp * np.sin(k * phase)
    env = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * (2.2 + 0.3 * seed) * t))
    sig = sig * env + 0.01 * rng.standard_normal(len(t))
    return (sig / np.abs(sig).max() * 0.3).astype(np.float32)


def test_filterbank_shape_and_frames():
    fb = mel_filterbank()
    assert fb.shape == (40, 201) and (fb >= 0).all()
    assert mel_frames(np.zeros(16000, np.float32)).shape == (101, 40)


def test_embedding_is_unit_and_deterministic():
    w = voice(120, (700, 1200))
    a, b = encoder().embed(w), encoder().embed(w)
    assert abs(np.linalg.norm(a) - 1) < 1e-4 and np.allclose(a, b)
    assert encoder().embed((w * 32767).astype(np.int16)) @ a > 0.99   # int16 input works too


def test_owner_vs_others():
    owner = [voice(115, (650, 1150, 2500), seed=s) for s in range(4)]
    prof = VoiceProfile.create(owner[:3])
    own = prof.similarity(owner[3])
    other = prof.similarity(voice(230, (900, 1900, 3000), seed=5))
    assert own > other + 0.05
    assert prof.matches(owner[3])[0]
    assert 0.70 <= prof.threshold <= 0.84


def test_profile_save_load_and_adapt(tmp_path):
    prof = VoiceProfile.create([voice(115, (650, 1150), seed=s) for s in range(3)])
    p = tmp_path / "voice_profile.json"
    prof.save(p)
    back = VoiceProfile.load(p)
    assert back is not None and abs(back.threshold - prof.threshold) < 1e-6
    assert float(back.embedding @ prof.embedding) > 0.9999
    back.adapt(voice(115, (650, 1150), seed=9))
    assert abs(np.linalg.norm(back.embedding) - 1) < 1e-5
    assert VoiceProfile.load(tmp_path / "missing.json") is None


def test_short_words_get_lenient_threshold():
    prof = VoiceProfile(np.ones(256, np.float32), threshold=0.8)
    prof.similarity = lambda wav: 0.76
    assert prof.matches(np.zeros(8000, np.float32))[0] is True      # 0.5 s "haan"
    assert prof.matches(np.zeros(32000, np.float32))[0] is False     # 2 s sentence


def test_listen_skips_speech_to_text_for_other_voices(monkeypatch, tmp_path):
    from karishma.config import Config

    fake_sd = types.ModuleType("sounddevice")

    class Stream:
        def __init__(self, **kw): self.n = 0
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, n):
            self.n += 1
            lvl = 3000 if 3 < self.n < 25 else 20
            return (np.random.default_rng(self.n).standard_normal((n, 1)) * lvl).astype(np.int16), False

    fake_sd.InputStream = lambda **kw: Stream()
    monkeypatch.setitem(sys.modules, "sounddevice", fake_sd)
    from karishma.voice import Ears

    e = Ears.__new__(Ears)
    e.cfg, e.threshold, e.level, e.last_error, e.mic_blocked = Config(home=tmp_path), 400.0, 0.0, "", False
    e.last_pcm, e.rejected = None, 0
    stt_calls = []
    e.transcribe = lambda wav: stt_calls.append(1) or "Karishma Spotify chalao"
    e.verifier = lambda pcm: False          # not the owner
    assert e.listen(max_wait=2) == "" and stt_calls == [] and e.rejected == 1
    e.verifier = lambda pcm: True           # the owner
    assert e.listen(max_wait=2) == "Karishma Spotify chalao" and stt_calls == [1]
