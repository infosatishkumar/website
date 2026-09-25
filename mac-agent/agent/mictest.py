"""Checks the microphone, speech recognition and the voice step by step.

Run:  bash test_mic.sh
"""

import time

import speech_recognition as sr

from .config import Config
from .voice import Listener, Speaker, SoundDeviceMicrophone, list_voices


def main():
    config = Config()
    print("\n=== 1. Voice ===")
    speaker = Speaker(config)
    female = [n for n, loc in list_voices() if n.split(" (")[0] in
              {"Isha", "Veena", "Lekha", "Samantha", "Karen", "Moira", "Tessa", "Serena", "Ava", "Zoe"}]
    print("Female voices installed:", ", ".join(female) or "(none)")
    print("Using voice:", speaker.voice or "(system default)")
    speaker.speak("Namaste! Ye meri awaaz ka test hai.", block=True)

    print("\n=== 2. Microphone ===")
    try:
        import sounddevice as sd

        print(sd.query_devices())
        mic = SoundDeviceMicrophone()
        print(f"Input: {mic.device_name} @ {mic.SAMPLE_RATE} Hz")
    except Exception as exc:
        print("❌ Microphone nahi mila:", exc)
        return

    print("\n👉 Ab 5 second kuch boliye, jaise: 'Karishma Chrome kholo'")
    time.sleep(0.5)
    recognizer = sr.Recognizer()
    with mic as source:
        audio = recognizer.record(source, duration=5)
        peak = source.stream.peak
    print(f"Awaaz ka level (peak): {peak}  (0 = mic blocked, 500+ = theek)")
    if peak == 0:
        print("❌ Mic se bilkul awaaz nahi aa rahi. System Settings › Privacy & Security › Microphone")
        print("   me Terminal (aur agent app) ko ON karein, phir dobara chalaiye.")
        return
    if peak < 300:
        print("⚠️  Awaaz bahut dhimi hai. System Settings › Sound › Input me input volume badhaiye.")

    print("\n=== 3. Speech to text ===")
    try:
        text = recognizer.recognize_google(audio, language=config["stt_language"])
        print(f"✅ Suna: “{text}”")
    except sr.UnknownValueError:
        print("⚠️  Awaaz aayi par samajh nahi aayi. Thoda paas aur saaf boliye.")
    except Exception as exc:
        print("❌ Speech service error:", exc)

    print("\n=== 4. Listening like the agent does ===")
    print("👉 Ab boliye: 'Karishma' (10 second tak intezaar karega)")
    listener = Listener(config)
    text = listener.listen(timeout=10, phrase_limit=8)
    print("Result:", repr(text), "| problem:", listener.problem, "| error:", listener.error)


if __name__ == "__main__":
    main()
