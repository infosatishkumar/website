"""Microphone input (speech-to-text) and spoken output (macOS `say`)."""

import re
import subprocess
import threading

import speech_recognition as sr

# Preferred voices for Hinglish text written in Latin script, best first.
PREFERRED_VOICES = [
    "Isha (Premium)", "Isha (Enhanced)", "Isha",
    "Veena (Premium)", "Veena (Enhanced)", "Veena",
    "Rishi (Enhanced)", "Rishi",
    "Samantha (Enhanced)", "Samantha",
]

_VOICE_LINE = re.compile(r"^(.+?)\s{2,}([a-z]{2,3}[_-][A-Za-z0-9]+)\s+#")
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")


def list_voices():
    """[(name, locale)] of voices installed for `say`."""
    try:
        out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    voices = []
    for line in out.splitlines():
        m = _VOICE_LINE.match(line)
        if m:
            voices.append((m.group(1).strip(), m.group(2)))
    return voices


def pick_voice(preferred=""):
    names = [v[0] for v in list_voices()]
    if preferred and preferred in names:
        return preferred
    for name in PREFERRED_VOICES:
        if name in names:
            return name
    indian = [n for n, loc in list_voices() if loc.endswith("IN")]
    return indian[0] if indian else ""


def clean_for_speech(text):
    """Strip markdown, links and emoji so `say` reads naturally."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", "link", text)
    text = re.sub(r"[*_#>|~]+", " ", text)
    text = _EMOJI.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


class Speaker:
    def __init__(self, config):
        self.config = config
        self._proc = None
        self._lock = threading.Lock()
        self.voice = pick_voice(config["voice"])

    def refresh_voice(self):
        self.voice = pick_voice(self.config["voice"])

    @property
    def speaking(self):
        return self._proc is not None and self._proc.poll() is None

    def speak(self, text, block=True, interrupt=False):
        text = clean_for_speech(text)
        if not text or not self.config["speak_replies"]:
            return
        if interrupt:
            self.stop()
        else:
            self.wait()  # let the previous sentence finish
        cmd = ["say", "-r", str(self.config["speech_rate"])]
        if self.voice:
            cmd += ["-v", self.voice]
        cmd.append(text)
        with self._lock:
            try:
                self._proc = subprocess.Popen(cmd)
            except OSError:
                self._proc = None
                return
        if block:
            self._proc.wait()

    def wait(self):
        proc = self._proc
        if proc is not None:
            proc.wait()

    def stop(self):
        with self._lock:
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
            self._proc = None


class SoundDeviceMicrophone(sr.AudioSource):
    """Microphone for SpeechRecognition built on `sounddevice`.

    sounddevice ships its own PortAudio library, so nothing extra (Homebrew,
    portaudio, PyAudio) has to be installed. Works on Intel and Apple Silicon Macs.
    """

    def __init__(self, sample_rate=16000, chunk_size=1024):
        self.SAMPLE_RATE = sample_rate
        self.SAMPLE_WIDTH = 2  # 16-bit
        self.CHUNK = chunk_size
        self.stream = None
        self._raw = None

    def __enter__(self):
        import sounddevice as sd

        self._raw = sd.RawInputStream(
            samplerate=self.SAMPLE_RATE, blocksize=self.CHUNK, channels=1, dtype="int16"
        )
        self._raw.start()
        self.stream = _StreamReader(self._raw)
        return self

    def __exit__(self, *exc):
        try:
            self._raw.stop()
            self._raw.close()
        finally:
            self._raw = None
            self.stream = None


class _StreamReader:
    def __init__(self, raw):
        self._raw = raw

    def read(self, frames):
        data, _overflowed = self._raw.read(frames)
        return bytes(data)


class Listener:
    """Captures one spoken phrase at a time and turns it into text."""

    def __init__(self, config):
        self.config = config
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        self.mic = None
        self.error = None

    def open(self):
        try:
            self.mic = SoundDeviceMicrophone()
            with self.mic as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
            self.error = None
        except Exception as exc:  # no mic / permission denied
            self.mic = None
            self.error = str(exc)
        return self.mic is not None

    def listen(self, timeout=5, phrase_limit=15):
        """Return the recognised text, "" for silence/unclear, None on mic error."""
        if self.mic is None and not self.open():
            return None
        try:
            with self.mic as source:
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_limit)
        except sr.WaitTimeoutError:
            return ""
        except Exception as exc:
            self.error = str(exc)
            self.mic = None
            return None
        try:
            return self.recognizer.recognize_google(audio, language=self.config["stt_language"]).strip()
        except sr.UnknownValueError:
            return ""
        except sr.RequestError as exc:
            self.error = f"Speech service error: {exc}"
            return ""
