# 🟣 Karishma — aapki apni AI assistant (MacBook ke liye)

Karishma ek **voice AI agent** hai jo aapke MacBook (2019 Intel bhi) par chalti hai.
Aap bolte ho, wo sunti hai, samajhti hai (**Claude** brain), kaam karti hai, aur
**ElevenLabs** ki awaaz me jawab deti hai — Hindi, Hinglish ya English me.

## Kya-kya kar sakti hai

| Aap bolo… | Karishma kya karegi |
|---|---|
| "Karishma, kal Delhi se Mumbai ki sabse sasti flight dhundo" | Web search + browser me MakeMyTrip/Cleartrip khol ke compare karegi, price batayegi |
| "Karishma, 15 tareekh ki Rajdhani me 2 tickets book karo" | IRCTC kholegi, details bharegi, **aapse confirm** karegi, payment/OTP aap khud karoge |
| "Swiggy se paneer biryani order kar do" | Swiggy kholegi, item cart me dalegi, total batake confirm karegi |
| "BookMyShow pe aaj shaam ki movie dikhao" | Shows dhund ke batayegi, seat choose karwayegi |
| "Volume 30 kar do", "Spotify chalao", "dark mode on" | AppleScript se Mac control |
| "Kal 9 baje doctor ka reminder lagao" | Reminders / Calendar me add |
| "Downloads folder me sabse badi files kaunsi hain?" | Shell command chala ke batayegi |
| "Screen pe kya dikh raha hai?" | Screenshot le ke dekhegi aur samjhayegi |
| "Bitcoin ka aaj ka rate?", "Is topic pe research karo" | Live web research |
| "Yaad rakhna mera ghar Jaipur me hai" | Hamesha ke liye yaad rakhegi |

### Safety (aapke paise aur data ke liye)
- Koi bhi **booking / order / payment / message bhejna / delete** — pehle aapse **"haan ya nahi"** puchegi.
- "Pay", "Place Order", "Book Now" jaise buttons code-level par bhi lock hain — bina aapke "haan" ke click nahi honge.
- **Card number, CVV, OTP, UPI PIN, password kabhi type nahi karegi** — ye browser window me aap khud bharoge.
- Khatarnak commands (jaise `rm -rf /`, disk erase) hamesha blocked hain. Kuch bhi system change karne wala command pehle aapko dikhayegi.

## Setup (sirf ek baar, ~10 minute)

1. Ye `karishma` folder apne Mac me rakho (jaise `~/karishma`).
2. **Terminal** kholo aur chalao:

```bash
cd ~/karishma
```

```bash
./setup_mac.sh
```

3. Apni keys `.env` file me daalo:

```bash
open -e .env
```

   - `ANTHROPIC_API_KEY` → https://console.anthropic.com (brain)
   - `ELEVENLABS_API_KEY` → https://elevenlabs.io/app/settings/api-keys (voice)
   - `ELEVENLABS_VOICE_ID` → ElevenLabs Voice Library me koi female Hindi voice choose karke uska ID (khaali chhodoge to Karishma khud ek female/Hindi voice chun legi)
   - `KARISHMA_USER_NAME`, `KARISHMA_USER_CITY` → aapka naam aur shehar

4. Setup check karo:

```bash
./run.sh --check
```

## App ki tarah chalana (Terminal ki zarurat nahi)

Setup ke time `Karishma.app` apne aap **Applications** me ban jaati hai. Agar nahi bani to:

```bash
./make_app.sh
```

Phir **Launchpad / Applications → Karishma** kholiye. Screen ke upar-right kone me Karishma ke animated sparkles (✦, `karishma/assets/karishma_orb.json` Lottie) aate hain.
Sochte waqt tez, bolte waqt thode tez, sote waqt dheere chalte hain. Rang: `.env` me `KARISHMA_STAR_COLOR=gradient`
(bangni-gulabi, default) ya `white`.

**Bulana:** sirf **"Karishma"** boliye (ya "Karishma, YouTube kholo" ek saath). "bye" bolne par wo chhup jaati hai,
aur ~15 sec chup rehne par bhi. Face/gole par ya Dock me **K** par click = typing box.
Note: mic "Karishma" sunne ke liye on rehta hai, isliye Mac upar **orange mic dot** dikhata hai (Apple ka niyam,
har app ke liye). Dot nahi chahiye to `.env` me `KARISHMA_MIC_ALWAYS_ON=false` + `./make_app.sh --siri`:
tab "Hey Siri, Karishma" / keyboard shortcut / click se bulana hoga.

Jawab gole ke neeche card me dikhte hain; kisi vyakti / company / cheez ke baare me poochho to Siri jaisi
result cards (click = link khulta hai). **Right-click** = menu (pause, naya topic, settings, band karo).
Face ko drag karke kahin bhi rakh sakte hain. Confirm karte waqt Karishma sirf chhota sawaal bolti hai
(command screen par dikhta hai); bolte-bolte bhi "haan" / "nahi" bol sakte ho.

**Beech me bolna:** Headphones par kuch bhi bolo to turant ruk kar sunti hai. MacBook speaker par
"Karishma …", "ruko" ya "bas" bolo (ya face par click) — apni hi awaaz se nahi rukti.

Mac on hote hi apne aap chalu ho, iske liye:

```bash
./make_app.sh --login
```

## Terminal se chalana

Voice mode ("Karishma" bol ke jagao):

```bash
./run.sh
```

Ya Finder me **Karishma.command** pe double-click.

Keyboard se type karke (bina mic):

```bash
./run.sh --text
```

Type bhi karo aur jawab awaaz me bhi suno:

```bash
./run.sh --text --speak
```

Listening modes (`.env` me `KARISHMA_LISTEN_MODE` ya `--mode`):
- `wake` (default) — "**Karishma**, …" bolne par sunti hai; jawab ke baad 45 second tak bina naam liye follow-up sun leti hai.
- `always` — har baat sunti hai.
- `ptt` — Enter dabao, phir bolo.

Kuch khaas commands: "**naya topic**" (nayi conversation), "**bye**" (so jao), Ctrl+C (band).

## Mac permissions (pehli baar)
System Settings → Privacy & Security me **Terminal** ko allow karo:
- **Microphone** — sunne ke liye
- **Accessibility** + **Automation** — apps control karne ke liye
- **Screen Recording** — screen dekhne ke liye

## Booking/ordering kaise kaam karti hai
Karishma ek alag browser window kholti hai (profile `~/.karishma/browser-profile` me save hota hai).
Pehli baar IRCTC / Amazon / Swiggy pe **aap khud login kar lo** — uske baad login yaad rahega.
Payment page aane par Karishma ruk ke aapko bolegi — aap OTP/PIN daalo aur "ho gaya" bolo.

> Purana macOS (13 se pehle) ho aur Chromium na chale to `.env` me `KARISHMA_BROWSER_CHANNEL=chrome` likho (Google Chrome installed hona chahiye).

## Dusri company ki API (Claude ke tokens khatam hone par)
`.env` (right-click > Settings) me:

| Kya chahiye | Kya likhna hai |
|---|---|
| Claude khatam ho to apne aap Gemini | `KARISHMA_BACKUP_BRAIN=gemini` + `GEMINI_API_KEY=...` |
| Hamesha OpenAI se chalao | `KARISHMA_BRAIN=openai` + `OPENAI_API_KEY=...` |
| Groq (bahut tez, free tier) | `KARISHMA_BRAIN=groq` + `GROQ_API_KEY=...` |
| OpenRouter (ek key me sab models) | `KARISHMA_BRAIN=openrouter` + `OPENROUTER_API_KEY=...` + `KARISHMA_OPENROUTER_MODEL=...` |
| Laptop par free (Ollama) | Ollama install + `KARISHMA_BRAIN=ollama` |
| Koi aur OpenAI-compatible API | `KARISHMA_BRAIN=custom` + `KARISHMA_CUSTOM_BASE_URL/API_KEY/MODEL` |

Model ka naam provider ki website se lekar `KARISHMA_<PROVIDER>_MODEL=` me daal sakte hain.
Dusri APIs ke saath internet search ke liye free DuckDuckGo search use hota hai.

## Speed
- Volume, app/website kholna, time, date jaise kaam **bina AI ke turant** hote hain.
- Lambe jawab tukdon me bole jaate hain (pehla tukda turant), chhote jawab yaad rehte hain.
- Aur tez chahiye to `KARISHMA_MODEL=claude-haiku-5-5` (sabse tez Claude) ya `KARISHMA_BRAIN=groq`.

## Settings
| Variable | Default | Matlab |
|---|---|---|
| `KARISHMA_MODEL` | `claude-opus-5-5` | Claude model |
| `KARISHMA_EFFORT` | `medium` | `low` = tez jawab, `high` = zyada soch ke |
| `ELEVENLABS_TTS_MODEL` | `eleven_multilingual_v2` | Awaaz ka model (Hindi support) |
| `ELEVENLABS_STT_MODEL` | `scribe_v1` | Sunne ka model |

Kharcha: har sawaal Claude API + ElevenLabs credits use karta hai. `wake` mode me har boli hui line
ElevenLabs speech-to-text pe jaati hai (wake word check ke liye) — kharcha kam rakhna ho to `ptt` mode use karo.

## Kya nahi kar sakti
- Phone call / WhatsApp on phone — sirf Mac pe jo ho sakta hai wahi.
- OTP, captcha, payment PIN — ye aap karoge (security ke liye jaan-boojh ke).

## Developer notes
```
karishma/
  main.py      voice/text loop, wake word
  brain.py     Claude agent loop (tools, web search, adaptive thinking)
  voice.py     mic recording, ElevenLabs STT/TTS, macOS `say` fallback
  tools/       system.py (shell, AppleScript, screenshot), browser.py (Playwright), memory.py
tests/         pytest (Linux/Mac par chalte hain, API key nahi chahiye)
```
Logs: `~/.karishma/karishma.log`. Tests: `.venv/bin/python -m pytest -q`
