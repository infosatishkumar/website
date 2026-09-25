# 🎙️ Karishma — Aapka Personal AI Agent (MacBook)

Ek voice AI agent jo aapke MacBook par chalta hai. Aap bolte ho, wo karta hai.
Brain: **Claude API** (aapki API key). Animation: aapka diya hua Lottie orb.

## Ye kya kar sakta hai

| Aap bolo… | Agent kya karega |
|---|---|
| "Karishma, Chrome kholo" / "WhatsApp open karo" | Koi bhi installed app khol deta hai |
| "YouTube pe Arijit ke gaane chalao" | Chrome me search karke kholta hai |
| "AI agents ke baare me research karo" | Web search karke report `~/Documents/AI-Agent/research/` me banata hai aur summary bolta hai |
| "Diwali sale ka Instagram poster banao" | Poster design karke PNG banata hai, Preview me kholta hai |
| "Desktop wali video ke pehle 10 second kaat do aur reel size me karo" | ffmpeg se video edit karta hai (original safe rehti hai) |
| "Screen pe kya hai?" | Screenshot lekar dekh ke batata hai |
| "Volume 30 karo" / "Dark mode on karo" / "10 minute ka timer lagao" | Mac control |
| "Apna naam Satish rakh lo" | Naam badal leta hai, ab "Satish" bolne se jaagega |
| "Karishma bolne se active hona" | Wake word badal deta hai |
| "Bye" / "So jao" | Wapas wake word ka intezaar karta hai |
| Kuch bhi poocho | Baat karta hai, jawab deta hai, beech me updates bhi deta hai |

Kaam karte waqt orb ki animation state dikhati hai: 😴 sleeping (dhimi), 👂 sun raha hai (glow), ⚙️ kaam chal raha hai (tez ring), 🗣️ bol raha hai (pulse).

## Setup (ek baar, ~5 minute)

1. **Ye folder apne Mac par laayein**:
   ```bash
   git clone https://github.com/infosatishkumar/website.git
   cd website/mac-agent
   ```
2. **Setup chalayein** (Homebrew chahiye: https://brew.sh):
   ```bash
   bash setup.sh
   ```
   Ye Python, mic support (portaudio) aur ffmpeg install karega, aapki Claude API key poochega
   (https://console.anthropic.com se milegi), aur `/Applications/Karishma.app` bana dega.
3. **App kholiye**: Launchpad ya Spotlight (⌘ + Space) me "Karishma" likhiye. Dock me pin bhi kar sakte hain.
4. **Permissions** — pehli baar macOS poochega, sab ko **Allow** karein:
   - Microphone (awaaz sunne ke liye)
   - Automation / Apple Events (Chrome, Finder etc. control ke liye)
   - Accessibility — System Settings › Privacy & Security › Accessibility me "Karishma" ON (typing/shortcuts ke liye)
   - Screen Recording (sirf "screen pe kya hai" ke liye)
   - Chrome me: View › Developer › **Allow JavaScript from Apple Events** (page padhne ke liye, optional)

Login par apne aap start karna ho to: `bash make_app.sh --login`

## Use kaise karein

- Bolein: **"Karishma"** → wo bolegi "Haan Satish, boliye?" → apna kaam bolein.
- Ya ek saath: **"Karishma, Chrome me Google Docs kholo"**.
- Jawab ke baad ~25 second tak bina naam liye follow-up bol sakte hain.
- Orb par click = sunna shuru. Kaam chal raha ho to click/■ = rok do.
- Neeche box me type karke bhi baat kar sakte hain.
- ⚙︎ Settings: API key, naam, wake word, voice, speed, bhasha (Hinglish / Hindi / English), model.

Banaye gaye files: `~/Documents/AI-Agent/` (posters, videos, research).
Logs: `~/Library/Logs/AI-Agent.log`. Terminal se chalana ho: `bash run.sh`.

## Behtar awaaz

System Settings › Accessibility › Spoken Content › System Voice › Manage Voices me
**English (India) → Isha / Veena (Premium ya Enhanced)** download karein. Agent apne aap sabse achhi Indian voice chun leta hai.

## Safety

Agent aapke Mac par sab kuch kar sakta hai, isliye:
- Delete / move / overwrite, sudo, message ya email bhejna jaise kaam **pehle aapse poochkar** hi karta hai.
- Video editing me original file kabhi overwrite nahi hoti.
- API key sirf aapke Mac par `~/Library/Application Support/AI-Agent/config.json` me rehti hai.
- Awaaz ko text me badalne ke liye Google speech recognition use hota hai (internet chahiye). Wake word sunne ke liye mic ki audio Google ko jaati hai.

## Kharcha

Har request Claude API use karti hai. Settings me **Model: Claude Sonnet 5** aur **Effort: Low** rakhne se sasta aur tez hota hai;
**Claude Opus 5** sabse smart hai (default).

## Files

```
mac-agent/
├── setup.sh          # one-time install
├── make_app.sh       # /Applications/<Naam>.app banata hai
├── run.sh            # Terminal se start
├── agent/
│   ├── main.py       # window + mic loop + wake word
│   ├── brain.py      # Claude API tool-use loop
│   ├── tools.py      # apps, Chrome, shell, poster, video, screenshot, timer...
│   ├── voice.py      # speech-to-text + macOS `say`
│   ├── wake.py       # kisi bhi naam ka wake word (fuzzy match)
│   └── config.py     # settings (naam, key, voice)
├── ui/               # orb UI + aapki Lottie animation
└── assets/           # app icon
```
