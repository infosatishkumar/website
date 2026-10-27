# Karishma 💕 — tumhari AI desktop dost

Karishma Desktop Mate jaisi app hai jo MacBook ki screen pe rehti hai. Woh Dock ke upar ghoomti hai, tumhari windows pe baithti hai aur mouse cursor ke saath khelti hai. Sir pe haath pherne (head pat) pe khush ho jaati hai. Alarm aur reminder bhi deti hai, aur **Claude AI** ke brain aur **ElevenLabs** ki awaaz se tumse baat karti hai.

Yeh Intel Macs pe bhi chalti hai, jaise MacBook Pro 2019. Asli Desktop Mate Intel Macs pe nahi chalta.

## Features

| | |
|---|---|
| 🚶 **Desktop pe zindagi** | Dock ke upar walk karti hai, baithti hai, stretch karti hai, dance karti hai, tum door ho toh so jaati hai (Zzz) |
| 🪟 **Windows pe baithna** | Front window ke upar pair latka ke baithti hai, aur window move karo toh saath chalti hai |
| 🖱️ **Cursor ke saath khel** | Aankhen cursor follow karti hain, paas aao toh haath badhati hai, chaho toh cursor ka peecha karti hai |
| 🤗 **Head pats** | Mouse ko uske sir pe aage-peeche ghumao: blush, hearts 💕 |
| ✋ **Pakdo aur phenko** | Drag karke utha lo ya phenk do. Gravity aur bounce hai, aur zor se phenko toh chakkar aa jaata hai 😵 |
| 🧠 **Claude AI brain** | Double-click ya ⌘⇧K se baat karo. Woh Hinglish/Hindi/English mein jawab deti hai, baat karte-karte alarm/reminder set karti hai, animations karti hai aur tumhari baatein yaad rakhti hai |
| 🎙️ **ElevenLabs voice** | Natural awaaz. Bolte waqt munh awaaz ke hisaab se hilta hai (lip-sync). Key nahi hai toh Mac ki free voice use hoti hai |
| ⏰ **Alarm & reminders** | Daily alarm (din choose karo), snooze, Pomodoro, paani aur break reminders, hourly chime |
| 👗 **Look** | 5 outfits, size slider, aur apna **3D VRM model** bhi laga sakte ho (VRoid Studio / VRoid Hub) |

## MacBook pe install kaise karein

### Option A: ready-made app (.dmg)

1. GitHub repo mein **Actions → "Build Karishma for macOS"** kholo. Latest run se **Karishma-macOS** artifact download karo. (Run nahi dikhe toh **Run workflow** dabao.)
2. Zip ke andar `Karishma-1.0.0.dmg` hogi. Intel Mac (2019) ke liye woh lo jiske naam mein `arm64` **nahi** hai.
3. DMG kholo aur Karishma ko Applications mein drag karo.
4. App signed nahi hai, isliye pehli baar: **Applications mein Karishma pe right-click → Open → Open**.
   Agar "damaged" bole toh Terminal mein chalao:
   ```bash
   xattr -cr /Applications/Karishma.app
   ```

### Option B: source se chalao

[Node.js 22](https://nodejs.org) install karo, phir:

```bash
git clone https://github.com/infosatishkumar/website.git
cd website/karishma
npm install
npm start          # seedha chalao
npm run dist       # Intel Mac ke liye .dmg banao (dist/ folder mein)
```

## Pehli baar setup

Menu bar mein Karishma ka icon aayega (upar right side). Usse ya Karishma pe **right-click** karke **Settings…** kholo:

1. **Claude API key**: [platform.claude.com](https://platform.claude.com/settings/keys) se key banao aur paste karo. Default model Claude Opus 5.5 hai. Sasta/fast chahiye toh Sonnet 5.5 ya Haiku 5.5 choose karo.
2. **ElevenLabs API key**: [elevenlabs.io](https://elevenlabs.io) → Profile → API Keys. Save karke **Load voices** dabao aur koi bhi voice choose karo. Hindi ke liye "Flash v2.5" ya "Multilingual v2" model rakho.
3. **Windows pe baithna**: Mac permission maangega. **System Settings → Privacy & Security → Accessibility** mein Karishma ko on karo.
4. Apna naam daalo, alarms lagao, outfit chuno, aur "Mac start hote hi Karishma aa jaaye" on kar do.

Dono keys Mac ke Keychain se encrypted save hoti hain.

## Kaise khelein

| Kya karo | Kya hoga |
|---|---|
| Sir pe mouse aage-peeche ghumao | Head pat 🥰 |
| Click | Woh react karti hai |
| Double-click / ⌘⇧K | Chat box khulega |
| Drag & chhod do | Utha ke phenko 🎢 |
| Right-click | Menu: dance, wave, reminder, size, outfit, settings |
| ⌘⇧H | Chhupao / wapas dikhao |

Chat mein aise bolo: *"kal subah 6:30 ka alarm laga do"*, *"20 minute baad chai yaad dilana"*, *"ek dance karke dikhao"*, *"yaad rakhna mera birthday 5 March hai"*.

## 3D model (optional)

[VRoid Studio](https://vroid.com/en/studio) (free) mein apni Karishma ka 3D character banao, ya [VRoid Hub](https://hub.vroid.com) se koi bhi model download karo jiska license allow karta ho. Phir Settings → Look → **Choose .vrm file…**. Woh model bhi walk karega, baithega, blink karega, cursor dekhega aur bolte waqt lip-sync karega.

## Files

```
src/main.js            overlay window, tray menu, alarms, ElevenLabs voice, shortcuts
src/brain.js           Claude API: personality, tools (alarm, reminder, action, memory)
src/windowWatcher.js   front window ki position (AppleScript)
src/store.js           settings + Keychain-encrypted keys
src/renderer/          Karishma ka body: physics, behaviours, SVG rig, VRM support, bubble, chat
src/settings/          settings window
```
