# DigitalNgage — 33-second ad reel (9:16)

Vertical 1080×1920, 60 fps, for Instagram Reels, YouTube Shorts, Facebook and
WhatsApp Status. Indian-English voice-over by **Monika Sogam** (ElevenLabs),
original synthesised background music and sound effects, word-by-word captions.

## Script
> Is your business stuck online? Not anymore! This is DigitalNgage — Social
> Media, Meta and Google Ads, SEO, Websites, E-commerce, CRM Software, and
> Structural Engineering — all under one roof. We built the KIO Organics online
> store. Over six thousand leads in Metro CRM. Twenty projects for Delta
> Infrastructures. Trusted by fifty-plus brands. Your brand… could be next.
> Book your free audit today — digitalngage dot com!

## Files
- `index.html`, `ad.js` — the animation (GSAP timeline, seeked frame by frame). Cue times
  come from the pauses in `vo/monika-take4.mp3`.
- `render.js` — renders frames: `node render.js <outDir> 60 [start] [end]`
- `music_ad.py` — music + SFX + voice mix: `python3 music_ad.py sfx.json vo/monika-take4.mp3 audio`
- `vo/` — chosen voice-over take (and one alternative).

## Rebuild
```
cd digitalngage && python3 -m http.server 8770 &
DUMP_SFX=ad-reel/sfx.json node ad-reel/render.js /tmp/st 60 0 0 --stills 0.5
python3 ad-reel/music_ad.py ad-reel/sfx.json ad-reel/vo/monika-take4.mp3 ad-reel/audio
node ad-reel/render.js /tmp/frames 60
ffmpeg -framerate 60 -i /tmp/frames/f%06d.jpg -i ad-reel/audio/mix.wav -c:v libx264 -crf 17 \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -shortest DigitalNgage-Ad-Reel.mp4
```
