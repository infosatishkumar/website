"""Microphone input (speech-to-text) and spoken output (macOS `say`)."""

import array
import re
import subprocess
import threading

import speech_recognition as sr

# Female voices, best first. Indian English voices read Hinglish (Roman script) best.
# Better quality: System Settings > Accessibility > Spoken Content > System Voice >
# Manage Voices > English (India) > Isha / Veena (Premium or Enhanced).
PREFERRED_VOICES = [
    "Isha (Premium)", "Isha (Enhanced)", "Isha",
    "Veena (Premium)", "Veena (Enhanced)", "Veena",
    "Lekha (Premium)", "Lekha (Enhanced)", "Lekha",
    "Samantha (Premium)", "Samantha (Enhanced)", "Samantha",
    "Karen (Premium)", "Karen (Enhanced)", "Karen",
    "Moira (Enhanced)", "Moira", "Tessa (Enhanced)", "Tessa",
    "Serena (Premium)", "Serena (Enhanced)", "Serena",
    "Ava (Premium)", "Ava (Enhanced)", "Ava",
    "Zoe (Premium)", "Zoe (Enhanced)", "Zoe",
    "Allison (Enhanced)", "Allison", "Susan (Enhanced)", "Susan",
    "Victoria", "Kathy", "Fiona",
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
    """The voice set in Settings if installed, else the best female voice available."""
    names = [v[0] for v in list_voices()]
    if preferred and preferred in names:
        return preferred
    for name in PREFERRED_VOICES:
        if name in names:
            return name
    # Unknown voice list: `say` without -v uses the system voice.
    return ""


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

    def __init__(self, chunk_size=1024):
        import sounddevice as sd

        info = sd.query_devices(kind="input")  # raises if there is no input device
        self.device_name = info["name"]
        self.SAMPLE_RATE = int(info["default_samplerate"]) or 44100
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
        self.peak = 0  # loudest sample seen, to detect a muted/blocked mic

    def read(self, frames):
        data, _overflowed = self._raw.read(frames)
        data = bytes(data)
        samples = array.array("h", data)
        if samples:
            self.peak = max(self.peak, max(abs(min(samples)), max(samples)))
        return data


# Messages shown on screen when listening fails.
MIC_BLOCKED = ("Mic se awaaz nahi aa rahi. System Settings › Privacy & Security › Microphone "
               "me is agent app (ya Terminal) ko ON karke app dobara kholiye.")
NO_MIC = "Koi microphone nahi mila."
SPEECH_SERVICE = "Awaaz ko text me badalne wali service tak nahi pahunch paa rahi (internet check karein)."


class Listener:
    """Captures one spoken phrase at a time and turns it into text."""

    def __init__(self, config):
        self.config = config
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        self.mic = None
        self.error = None     # technical detail, for the log
        self.problem = None   # short message for the user, or None when all is well
        self.silent_reads = 0

    def open(self):
        try:
            self.mic = SoundDeviceMicrophone()
            with self.mic as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                peak = source.stream.peak
            # Noisy rooms can push the threshold so high that speech is never detected.
            self.recognizer.energy_threshold = min(max(self.recognizer.energy_threshold, 150), 1500)
            self.error = None
            self.problem = MIC_BLOCKED if peak == 0 else None
            print(f"[mic] {self.mic.device_name} @ {self.mic.SAMPLE_RATE} Hz, peak={peak}, "
                  f"threshold={self.recognizer.energy_threshold:.0f}", flush=True)
        except Exception as exc:  # no mic / permission denied
            self.mic = None
            self.error = str(exc)
            self.problem = NO_MIC
            print(f"[mic] open failed: {exc}", flush=True)
        return self.mic is not None

    def listen(self, timeout=5, phrase_limit=15):
        """Return the recognised text, "" for silence/unclear, None on mic error."""
        if self.mic is None and not self.open():
            return None
        try:
            with self.mic as source:
                try:
                    audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_limit)
                finally:
                    peak = source.stream.peak
        except sr.WaitTimeoutError:
            # Pure digital silence again and again means macOS is blocking the mic.
            self.silent_reads = self.silent_reads + 1 if peak == 0 else 0
            if self.silent_reads >= 2:
                self.problem = MIC_BLOCKED
            elif self.problem == MIC_BLOCKED and peak > 0:
                self.problem = None
            return ""
        except Exception as exc:
            self.error = str(exc)
            self.problem = NO_MIC
            self.mic = None
            print(f"[mic] listen failed: {exc}", flush=True)
            return None
        self.silent_reads = 0
        if self.problem == MIC_BLOCKED:
            self.problem = None
        try:
            text = self.recognizer.recognize_google(audio, language=self.config["stt_language"]).strip()
            if self.problem == SPEECH_SERVICE:
                self.problem = None
            print(f"[heard] {text}", flush=True)
            return text
        except sr.UnknownValueError:
            print("[heard] (samajh nahi aaya)", flush=True)
            return ""
        except Exception as exc:  # network error, FLAC converter problem...
            self.error = f"Speech service error: {exc}"
            self.problem = SPEECH_SERVICE
            print(f"[stt] {exc}", flush=True)
            return ""
