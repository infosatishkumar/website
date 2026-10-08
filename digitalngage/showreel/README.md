# DigitalNgage showreel (60 s, 1080p60)

Everything here is code: the animation is a GSAP timeline (`index.html` + `reel.js`),
rendered frame by frame with Playwright, and the soundtrack and sound effects are
synthesised in `music.py` from the cue list the timeline registers (so every hit is
on the same frame as its cut).

## Rebuild

```bash
# 1. serve the digitalngage folder (the page loads ../public_html/assets/vendor/gsap.min.js)
cd digitalngage && python3 -m http.server 8770 &

# 2. dump the sound-effect cues, then render frames (split across workers if you like)
cd showreel
DUMP_SFX=/tmp/sfx.json node render.js /tmp/stills 60 0 0 --stills 1
node render.js /tmp/frames 60 0 60

# 3. music + sound effects
python3 music.py /tmp/sfx.json /tmp/audio

# 4. encode
ffmpeg -framerate 60 -i /tmp/frames/f%06d.jpg -i /tmp/audio/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 320k -shortest DigitalNgage-Showreel-2026.mp4
```

## Voice-over

The script and cue times are in `voiceover-script.md` (ElevenLabs voice `cgSgspJ2msm6clMCkdW9`).

- `tts.py` generates `vo-01.mp3 … vo-09.mp3` from ElevenLabs. It reads the key from the
  `ELEVENLABS_API_KEY` environment variable and needs network access to `api.elevenlabs.io`.
- `mix_vo.py audio_dir vo_dir mix_vo.wav` places each line on its cue (or a single
  `vo-full.mp3` from 0:00) and ducks the music under the voice. Re-run step 4 with
  `mix_vo.wav` instead of `mix.wav`.
