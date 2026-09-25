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

Screen par sirf ek chhoti floating animation (aapka Lottie sparkle) desktop ke kone me rehti hai — koi window ya naam nahi.
Animation hi state dikhati hai: 😴 sleeping (dhimi), 👂 sun rahi hai (glow), ⚙️ kaam chal raha hai (pink glow, uchhalti hai), 🗣️ bol rahi hai (pulse).
Jab wo baat karti hai ya kaam karti hai tab neeche ek chhota caption aata hai, aur kaam khatam hone ke kuch second baad chala jaata hai.

## Setup (ek baar, ~5-10 minute) — Intel aur Apple Silicon dono Mac par

Homebrew ki zaroorat **nahi** hai.

1. **Claude API key banayein**: https://console.anthropic.com → Billing me credit daalein → API Keys → Create Key → copy (`sk-ant-...`).
2. **Terminal kholein** (⌘ + Space → `Terminal`) aur ye ek command paste karein:
   ```bash
   cd ~ && curl -L -o karishma.zip https://github.com/infosatishkumar/website/archive/refs/heads/claude/eager-noether-rib191.zip && unzip -oq karishma.zip && cd website-claude-eager-noether-rib191/mac-agent && bash setup.sh
   ```
   Ye Python, mic support aur video tools (ffmpeg) apne aap install karega.
3. Jab **"API key:"** likha aaye, apni key paste karein (⌘ + V) aur Enter dabayein. Key screen par dikhegi nahi — ye normal hai.
4. **App kholiye**: ⌘ + Space → "Karishma" → Enter. Dock me pin bhi kar sakte hain.
5. **Permissions** — macOS poochega, sab ko **Allow** karein:
   - Microphone (awaaz sunne ke liye)
   - Automation / Apple Events (Chrome, Finder etc. control ke liye)
   - Accessibility — System Settings › Privacy & Security › Accessibility me "Karishma" ON (typing/shortcuts ke liye)
   - Screen Recording (sirf "screen pe kya hai" ke liye)
   - Chrome me: View › Developer › **Allow JavaScript from Apple Events** (page padhne ke liye, optional)

Key baad me daalni/badalni ho: animation par **right-click › Settings** › Claude API key › Save.

Login par apne aap start karna ho to: `bash make_app.sh --login`

## Use kaise karein

- Bolein: **"Karishma"** → wo bolegi "Haan Satish, boliye?" → apna kaam bolein.
- Ya ek saath: **"Karishma, Chrome me Google Docs kholo"**.
- Jawab ke baad ~25 second tak bina naam liye follow-up bol sakte hain.
- Animation par **click** = sunna shuru. Kaam chal raha ho to click = rok do.
- Animation ko **drag** karke screen par kahin bhi rakh sakte hain.
- **Right-click** = menu: Type karein, Rok do, Mic band/chalu, Files, Settings, Chhupa do, Band karein.
- Settings: API key, naam, wake word, voice, speed, bhasha (Hinglish / Hindi / English), model.

Banaye gaye files: `~/Documents/AI-Agent/` (posters, videos, research).
Logs: `~/Library/Logs/AI-Agent.log`. Terminal se chalana ho: `cd ~/website-claude-eager-noether-rib191/mac-agent && bash run.sh`.

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
├── ui/               # floating animation widget + settings window
└── assets/           # app icon
```
