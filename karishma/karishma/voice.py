"""Ears and mouth: microphone recording, ElevenLabs speech-to-text and text-to-speech.

Falls back to macOS `say` for speech when no ElevenLabs key is set, and to
keyboard input in text mode.
"""

from __future__ import annotations

import io
import logging
import re
import shutil
import subprocess
import tempfile
import time
import wave
from pathlib import Path

from .config import Config

log = logging.getLogger("karishma.voice")

SAMPLE_RATE = 16000

YES_WORDS = re.compile(
    r"\b(haan|haa|ha|han|yes|yeah|yep|ok|okay|theek|thik|kar do|karo|karde|kar de|bilkul|sure|"
    r"confirm|go ahead|proceed|chalo|ji)\b|हाँ|हां|जी|ठीक|कर दो|करो",
    re.I,
)
NO_WORDS = re.compile(r"\b(nahi|nahin|no|nope|mat|ruko|cancel|stop|rehne do)\b|नहीं|मत|रुको", re.I)


def is_yes(answer: str) -> bool:
    answer = answer or ""
    if NO_WORDS.search(answer):
        return False
    return bool(YES_WORDS.search(answer))


def clean_for_speech(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1", text)  # markdown links
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_#`>|]+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def pcm_to_wav(pcm: bytes, rate: int = SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


class Mouth:
    """Text-to-speech."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._client = None
        self._proc: subprocess.Popen | None = None
        self.speaking = False
        self.interrupted = False
        self.last_end = 0.0
        if cfg.elevenlabs_api_key:
            from elevenlabs.client import ElevenLabs

            self._client = ElevenLabs(api_key=cfg.elevenlabs_api_key)
            if not cfg.elevenlabs_voice_id:
                cfg.elevenlabs_voice_id = self._pick_voice()

    def _pick_voice(self) -> str | None:
        try:
            voices = self._client.voices.get_all().voices
        except Exception as e:  # noqa: BLE001
            log.warning("could not list ElevenLabs voices: %s", e)
            return None
        def score(v):
            labels = {k: str(val).lower() for k, val in (getattr(v, "labels", None) or {}).items()}
            s = 0
            s += 2 if labels.get("gender") == "female" else 0
            s += 3 if "hindi" in str(labels).lower() or "indian" in str(labels).lower() else 0
            return s
        best = max(voices, key=score, default=None)
        if best:
            log.info("Using ElevenLabs voice %s (%s)", best.name, best.voice_id)
            return best.voice_id
        return None

    def stop(self) -> None:
        """Stop talking right now (user interrupted)."""
        self.interrupted = True
        proc = self._proc
        if proc and proc.poll() is None:
            proc.terminate()

    def speak(self, text: str) -> None:
        text = clean_for_speech(text)
        if not text:
            return
        print(f"\n🟣 Karishma: {text}\n", flush=True)
        self.interrupted = False
        self.speaking = True
        try:
            self._speak(text)
        finally:
            self.speaking = False
            self.last_end = time.time()

    def _speak(self, text: str) -> None:
        if self._client and self.cfg.elevenlabs_voice_id:
            try:
                audio = b"".join(
                    self._client.text_to_speech.convert(
                        self.cfg.elevenlabs_voice_id,
                        text=text,
                        model_id=self.cfg.tts_model,
                        output_format="mp3_44100_128",
                    )
                )
                self._play_mp3(audio)
                return
            except Exception as e:  # noqa: BLE001
                log.warning("ElevenLabs TTS failed, falling back: %s", e)
        if self.cfg.is_mac and shutil.which("say"):
            voice = "Lekha" if re.search(r"[ऀ-ॿ]", text) else "Veena"
            self._run(["say", "-v", voice, text])

    def _play_mp3(self, audio: bytes) -> None:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio)
            path = f.name
        try:
            if self.interrupted:
                return
            if shutil.which("afplay"):
                self._run(["afplay", path])
            elif shutil.which("ffplay"):
                self._run(["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", path])
        finally:
            Path(path).unlink(missing_ok=True)


    def _run(self, args: list[str]) -> None:
        self._proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self._proc.wait()
        finally:
            self._proc = None


_OUT_CACHE = {"t": 0.0, "speakers": True}


def output_is_speakers() -> bool:
    """True when sound plays from the laptop's own speakers (her voice echoes into the mic).
    False for headphones / AirPods / external output, where instant barge-in is safe."""
    now = time.time()
    if now - _OUT_CACHE["t"] > 10:
        _OUT_CACHE["t"] = now
        try:
            import sounddevice as sd

            name = str(sd.query_devices(kind="output")["name"]).lower()
            _OUT_CACHE["speakers"] = "speaker" in name or "built-in" in name
        except Exception:  # noqa: BLE001
            _OUT_CACHE["speakers"] = True
    return _OUT_CACHE["speakers"]


class Ears:
    """Microphone + speech-to-text."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        import numpy as np  # noqa: F401  (fail early if missing)
        import sounddevice  # noqa: F401

        from elevenlabs.client import ElevenLabs

        if not cfg.elevenlabs_api_key:
            raise RuntimeError("Voice mode needs ELEVENLABS_API_KEY (use --text for keyboard mode).")
        self._client = ElevenLabs(api_key=cfg.elevenlabs_api_key)
        self.threshold = 500.0
        self.mic_blocked = False
        self.last_error = ""
        self.level = 0.0  # 0..1, for the animated orb
        self.calibrate()

    def calibrate(self, seconds: float = 1.0) -> None:
        import numpy as np
        import sounddevice as sd

        audio = sd.rec(int(seconds * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype="int16")
        sd.wait()
        noise = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2)))
        # macOS gives pure digital silence (all zeros) when microphone permission is denied.
        self.mic_blocked = not np.any(audio)
        if self.mic_blocked:
            log.warning("microphone returns silence - permission probably denied")
        self.threshold = max(300.0, noise * 3.0)
        log.info("noise=%.0f threshold=%.0f", noise, self.threshold)

    def record(self, max_wait: float = 30.0, max_len: float = 30.0, silence: float = 0.8,
               echo_guard=None, on_start=None) -> bytes | None:
        """Record one utterance (energy-based voice detection). Returns WAV bytes or None.

        echo_guard(): True while Karishma herself is talking -> need louder, longer speech to start
        (so her own voice from the speakers isn't taken as the user). on_start() fires the moment
        the user starts speaking (used to stop Karishma mid-sentence)."""
        import numpy as np
        import sounddevice as sd

        block = int(SAMPLE_RATE * 0.05)  # 50 ms
        frames: list[bytes] = []
        pre_roll: list[bytes] = []
        started = False
        loud_blocks = 0
        quiet_time = 0.0
        t0 = time.time()
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16", blocksize=block) as stream:
            while True:
                data, _ = stream.read(block)
                rms = float(np.sqrt(np.mean(data.astype(np.float32) ** 2)))
                self.level = min(1.0, rms / (self.threshold * 6))
                chunk = data.tobytes()
                if not started:
                    pre_roll = (pre_roll + [chunk])[-8:]
                    guarded = bool(echo_guard and echo_guard())
                    need = self.threshold * (4.0 if guarded else 1.0)
                    loud_blocks = loud_blocks + 1 if rms > need else 0
                    if loud_blocks >= (6 if guarded else 2):
                        started = True
                        frames.extend(pre_roll)
                        t_start = time.time()
                        if on_start:
                            on_start()
                    elif time.time() - t0 > max_wait:
                        self.level = 0.0
                        return None
                    continue
                frames.append(chunk)
                quiet_time = quiet_time + 0.05 if rms < self.threshold else 0.0
                if quiet_time >= silence or time.time() - t_start > max_len:
                    break
        self.level = 0.0
        pcm = b"".join(frames)
        if len(pcm) < SAMPLE_RATE * 2 * 0.4:  # < 0.4 s -> noise
            return None
        return pcm_to_wav(pcm)

    def transcribe(self, wav: bytes) -> str:
        f = io.BytesIO(wav)
        f.name = "speech.wav"
        result = self._client.speech_to_text.convert(model_id=self.cfg.stt_model, file=f)
        text = (getattr(result, "text", "") or "").strip()
        # Drop pure sound-event tags like "(music)" or "[noise]".
        text = re.sub(r"[\(\[][^\)\]]*[\)\]]", "", text).strip()
        return text

    def listen(self, max_wait: float = 30.0, echo_guard=None, on_start=None) -> str:
        wav = self.record(max_wait=max_wait, echo_guard=echo_guard, on_start=on_start)
        if not wav:
            return ""
        try:
            return self.transcribe(wav)
        except Exception as e:  # noqa: BLE001
            log.warning("STT failed: %s", e)
            msg = str(e)
            if "401" in msg or "permission" in msg.lower() or "unauthorized" in msg.lower():
                self.last_error = ("ElevenLabs key ko 'Speech to Text' ki permission nahi hai. "
                                   "elevenlabs.io > API Keys me key edit karke Speech to Text ON kariye.")
            elif "quota" in msg.lower() or "credits" in msg.lower():
                self.last_error = "ElevenLabs credits khatam ho gaye hain."
            else:
                self.last_error = f"Sunne me error: {msg[:150]}"
            return ""
