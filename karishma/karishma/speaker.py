"""Recognise the owner's voice, so Karishma ignores other people talking in the background.

Uses the pretrained Resemblyzer voice encoder (GE2E, Apache-2.0, https://github.com/resemble-ai/Resemblyzer),
re-implemented in plain numpy so no PyTorch is needed on the Mac. Weights: assets/voice_encoder.npz.

    enrol:   profile = VoiceProfile.create([wav1, wav2, wav3])   # 16 kHz int16/float audio
    verify:  profile.matches(wav) -> (bool, similarity)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

log = logging.getLogger("karishma.speaker")

SR = 16000
N_FFT = 400        # 25 ms
HOP = 160          # 10 ms
N_MELS = 40
PARTIAL = 160      # frames per partial utterance (1.6 s)
WEIGHTS = Path(__file__).resolve().parent / "assets" / "voice_encoder.npz"


# ------------------------------------------------------------------ features
def _hz_to_mel(f):
    f = np.asanyarray(f, dtype=np.float64)
    f_sp = 200.0 / 3
    mels = f / f_sp
    min_log_hz, min_log_mel, logstep = 1000.0, 1000.0 / f_sp, np.log(6.4) / 27.0
    return np.where(f >= min_log_hz, min_log_mel + np.log(np.maximum(f, 1e-10) / min_log_hz) / logstep, mels)


def _mel_to_hz(m):
    m = np.asanyarray(m, dtype=np.float64)
    f_sp = 200.0 / 3
    freqs = f_sp * m
    min_log_hz, min_log_mel, logstep = 1000.0, 1000.0 / f_sp, np.log(6.4) / 27.0
    return np.where(m >= min_log_mel, min_log_hz * np.exp(logstep * (m - min_log_mel)), freqs)


def mel_filterbank(sr: int = SR, n_fft: int = N_FFT, n_mels: int = N_MELS) -> np.ndarray:
    """Same as librosa.filters.mel(sr, n_fft, n_mels) (Slaney scale + Slaney norm)."""
    fftfreqs = np.linspace(0, sr / 2, 1 + n_fft // 2)
    mel_f = _mel_to_hz(np.linspace(_hz_to_mel(0.0), _hz_to_mel(sr / 2), n_mels + 2))
    fdiff = np.diff(mel_f)
    ramps = mel_f[:, None] - fftfreqs[None, :]
    weights = np.zeros((n_mels, len(fftfreqs)))
    for i in range(n_mels):
        lower = -ramps[i] / fdiff[i]
        upper = ramps[i + 2] / fdiff[i + 1]
        weights[i] = np.maximum(0, np.minimum(lower, upper))
    enorm = 2.0 / (mel_f[2:n_mels + 2] - mel_f[:n_mels])
    weights *= enorm[:, None]
    return weights.astype(np.float32)


_FB = None
_WINDOW = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(N_FFT) / N_FFT)).astype(np.float32)  # periodic Hann


def mel_frames(wav: np.ndarray, pad_mode: str = "reflect") -> np.ndarray:
    """(n_frames, 40) power mel spectrogram, like librosa.feature.melspectrogram(...).T"""
    global _FB
    if _FB is None:
        _FB = mel_filterbank()
    y = np.pad(wav.astype(np.float32), N_FFT // 2, mode=pad_mode)
    n = 1 + (len(y) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n)[:, None]
    spec = np.abs(np.fft.rfft(y[idx] * _WINDOW, axis=1)) ** 2
    return (spec @ _FB.T).astype(np.float32)


def to_float(wav) -> np.ndarray:
    a = np.asarray(wav)
    if a.dtype == np.int16:
        a = a.astype(np.float32) / 32768.0
    return a.astype(np.float32).reshape(-1)


def normalize_volume(wav: np.ndarray, target_dbfs: float = -30.0) -> np.ndarray:
    rms = np.sqrt(np.mean(wav ** 2) + 1e-12)
    change = target_dbfs - 20 * np.log10(rms + 1e-12)
    return wav * (10 ** (change / 20)) if change > 0 else wav


def _sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -30, 30)))


# ------------------------------------------------------------------ the encoder
class VoiceEncoder:
    def __init__(self, weights: Path = WEIGHTS):
        w = np.load(weights)
        self.layers = [(w[f"lstm_weight_ih_l{i}"], w[f"lstm_weight_hh_l{i}"], w[f"lstm_bias_ih_l{i}"] + w[f"lstm_bias_hh_l{i}"])
                       for i in range(3)]
        self.lin_w, self.lin_b = w["linear_weight"], w["linear_bias"]

    def _forward(self, mels: np.ndarray) -> np.ndarray:
        """mels: (batch, frames, 40) -> L2-normalised embeddings (batch, 256)."""
        x = mels
        b, t, _ = x.shape
        for w_ih, w_hh, bias in self.layers:
            hid = w_hh.shape[1]
            h = np.zeros((b, hid), np.float32)
            c = np.zeros((b, hid), np.float32)
            xp = x @ w_ih.T + bias               # (b, t, 4h)
            outs = np.empty((b, t, hid), np.float32)
            for k in range(t):
                g = xp[:, k] + h @ w_hh.T
                i_, f_, g_, o_ = np.split(g, 4, axis=1)
                i_, f_, o_ = _sigmoid(i_), _sigmoid(f_), _sigmoid(o_)
                c = f_ * c + i_ * np.tanh(g_)
                h = o_ * np.tanh(c)
                outs[:, k] = h
            x = outs
        e = np.maximum(0, h @ self.lin_w.T + self.lin_b)
        return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-9)

    @staticmethod
    def partial_slices(n_samples: int, rate: float = 1.3, min_coverage: float = 0.75):
        samples_per_frame = HOP
        n_frames = int(np.ceil((n_samples + 1) / samples_per_frame))
        frame_step = int(np.round((SR / rate) / samples_per_frame))
        wav_slices, mel_slices = [], []
        steps = max(1, n_frames - PARTIAL + frame_step + 1)
        for i in range(0, steps, frame_step):
            mel_slices.append(slice(i, i + PARTIAL))
            wav_slices.append(slice(i * samples_per_frame, (i + PARTIAL) * samples_per_frame))
        last = wav_slices[-1]
        coverage = (n_samples - last.start) / (last.stop - last.start)
        if coverage < min_coverage and len(mel_slices) > 1:
            mel_slices, wav_slices = mel_slices[:-1], wav_slices[:-1]
        return wav_slices, mel_slices

    def embed(self, wav) -> np.ndarray:
        """256-d L2-normalised voice embedding of one utterance (any length)."""
        wav = normalize_volume(to_float(wav))
        wav_slices, mel_slices = self.partial_slices(len(wav))
        if wav_slices[-1].stop >= len(wav):
            wav = np.pad(wav, (0, wav_slices[-1].stop - len(wav)))
        frames = mel_frames(wav)
        mels = np.stack([frames[s] for s in mel_slices])
        partial = self._forward(mels)
        e = partial.mean(axis=0)
        return e / (np.linalg.norm(e) + 1e-9)


_ENCODER: VoiceEncoder | None = None


def encoder() -> VoiceEncoder:
    global _ENCODER
    if _ENCODER is None:
        _ENCODER = VoiceEncoder()
    return _ENCODER


# ------------------------------------------------------------------ the owner's voice profile
class VoiceProfile:
    """The enrolled owner's voice + a similarity threshold."""

    def __init__(self, embedding: np.ndarray, threshold: float = 0.75):
        self.embedding = embedding / (np.linalg.norm(embedding) + 1e-9)
        self.threshold = threshold
        self.strictness = 0.0   # + = stricter, - = more lenient (KARISHMA_VOICE_STRICTNESS)

    @classmethod
    def create(cls, wavs: list) -> "VoiceProfile":
        embs = np.stack([encoder().embed(w) for w in wavs])
        mean = embs.mean(axis=0)
        mean /= np.linalg.norm(mean) + 1e-9
        sims = embs @ mean
        # a little below the owner's own lowest enrolment similarity, kept in a sensible range
        thr = float(np.clip(sims.min() - 0.07, 0.70, 0.84))
        return cls(mean, thr)

    def adapt(self, wav, rate: float = 0.05) -> None:
        """Slowly follow the owner's voice over time (different mic distance, cold, mood)."""
        e = encoder().embed(wav)
        self.embedding = (1 - rate) * self.embedding + rate * e
        self.embedding /= np.linalg.norm(self.embedding) + 1e-9

    def similarity(self, wav) -> float:
        return float(encoder().embed(wav) @ self.embedding)

    def matches(self, wav, seconds: float | None = None) -> tuple[bool, float]:
        sim = self.similarity(wav)
        n = len(to_float(wav)) / SR if seconds is None else seconds
        thr = self.threshold + self.strictness - (0.06 if n < 1.0 else 0.0)  # short words ("haan") are less certain
        return sim >= thr, sim

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"embedding": self.embedding.round(6).tolist(), "threshold": self.threshold}))

    @classmethod
    def load(cls, path: Path) -> "VoiceProfile | None":
        try:
            d = json.loads(path.read_text())
            return cls(np.array(d["embedding"], np.float32), float(d["threshold"]))
        except (OSError, ValueError, KeyError):
            return None
