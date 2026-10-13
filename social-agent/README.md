# Social Media Agent 🤖

Ek AI agent (Claude se chalta hai) jo aapke social media accounts aapki taraf se chalata hai. Aap usse terminal me normal Hindi, Hinglish ya English me baat karte ho, aur wo ye kaam karta hai:

| Kaam | Facebook Page | Instagram | YouTube | X (Twitter) | LinkedIn |
|---|---|---|---|---|---|
| Post karna | ✅ text / link / photo | ✅ photo / Reel | – | ✅ | ✅ text |
| Video upload | ✅ (local file ya URL) | ✅ Reel (public URL) | ✅ (local file) | – | – |
| Comments padhna | ✅ | ✅ | ✅ | ✅ (mentions) | – |
| Comment ka reply | ✅ | ✅ | ✅ | ✅ | – |
| Naya comment | ✅ | ✅ (apni post par) | ✅ | ✅ | – |
| Messages / DM padhna | ✅ Messenger | ✅ | – (YouTube me DM nahi hota) | ✅ | – |
| Message bhejna | ✅ | ✅ | – | ✅ | – |

**Safety:** agent kuch bhi post karne, comment karne ya message bhejne se pehle aapko preview dikhata hai aur `y / n` poochta hai. Aap `n` bologe to kuch nahi jaayega. Aap sudhaar bhi likh sakte ho (jaise "thoda short karo"), to agent use badal kar dobara poochega.

Ye sirf har platform ki **official API** use karta hai. Aapka password kabhi nahi maanga jaata, sirf access token chahiye jo aap khud bana kar `.env` me daalte ho.

---

## 1. Setup

```bash
cd social-agent
npm install
cp .env.example .env     # ab .env me apni keys bharo
npm start
```

Node.js 20+ chahiye. Jis platform ka token `.env` me hoga, sirf wahi connect hoga. Baaki ko agent ignore kar dega.

Pehli baar test karne ke liye `.env` me `DRY_RUN=true` rakho. Tab agent sab kuch karke dikhayega, lekin asal me kuch post nahi karega.

## 2. Keys kahaan se milengi

### Claude (zaroori)
[console.anthropic.com](https://console.anthropic.com) par API key banao → `ANTHROPIC_API_KEY`.

### Facebook Page + Instagram
1. [developers.facebook.com](https://developers.facebook.com) par ek **Business** type app banao.
2. Instagram account ko **Professional (Business/Creator)** banao aur apne Facebook Page se link karo.
3. Graph API Explorer me in permissions ke saath **Page access token** lo:
   `pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages`
4. Short-lived token ko **long-lived** token me badlo. Long-lived Page token expire nahi hota.
5. `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` bharo. `IG_USER_ID` yahaan se milega: `GET /{page-id}?fields=instagram_business_account`.

> Meta ke rules: kisi bande ko message tabhi bhej sakte ho jab usne aapko pichhle 24 ghante me message kiya ho. Instagram par photo/Reel ke liye media ka **public https URL** chahiye, local file nahi chalegi. Apne account ke alawa doosre logon ke liye production me app ko Meta App Review se pass karwana padta hai.

### YouTube
1. [Google Cloud Console](https://console.cloud.google.com) → **YouTube Data API v3** enable karo.
2. OAuth client (Desktop app) banao → `YT_CLIENT_ID`, `YT_CLIENT_SECRET`.
3. [OAuth Playground](https://developers.google.com/oauthplayground) me apna client daalo, scope `https://www.googleapis.com/auth/youtube.force-ssl` aur `https://www.googleapis.com/auth/youtube.upload` select karo, phir refresh token lo → `YT_REFRESH_TOKEN`.

> Jo Google project verify nahi hua, uske upload kiye gaye videos YouTube private rakh deta hai. Agent bhi by default video ko `private` hi upload karta hai.

### X (Twitter)
[developer.x.com](https://developer.x.com) par app banao, OAuth 2.0 (PKCE) se in scopes ke saath **user access token** lo: `tweet.read tweet.write users.read dm.read dm.write offline.access` → `X_USER_ACCESS_TOKEN`. Kuch features (mentions, DMs) ke liye paid API tier chahiye.

### LinkedIn
[LinkedIn Developers](https://www.linkedin.com/developers) par app banao, "Share on LinkedIn" product add karo, `w_member_social` scope ke saath token lo → `LINKEDIN_ACCESS_TOKEN`.
`LINKEDIN_AUTHOR_URN` = `urn:li:person:<id>` (id `GET https://api.linkedin.com/v2/userinfo` ke `sub` field se milegi).

## 3. Kaise baat karein (examples)

```
You › Instagram ke last post pe jo comments aaye hain wo dikhao
You › sab comments ka reply draft karo, friendly tone me, Hinglish me
You › Facebook page pe post karo: "Naya logo design project live hai! 🎨"
You › ./videos/reel.mp4 ko YouTube pe upload karo, title "Logo Design Process", unlisted
You › Messenger me kis kis ne message kiya hai? Rahul ko reply karo ki kal call karte hain
You › X pe ek post likho mere naye blog ke baare me, pehle mujhe dikhana
```

Bahar nikalne ke liye `exit` likho.

## 4. Settings

| Variable | Matlab |
|---|---|
| `DRY_RUN=true` | Sirf dikhaata hai, kuch bhejta nahi |
| `AUTO_APPROVE=true` | Har baar bina poochhe post/send kar deta hai. Sambhal ke use karo |
| `AGENT_MODEL` | Default `claude-opus-5-5` |
| `AGENT_EFFORT` | `low` / `medium` (default) / `high`. Zyada effort matlab zyada soch-samajh kar kaam, lekin kharcha bhi zyada |

Agar Claude kabhi koi request safety ki wajah se mana kar de, to wo request apne aap ek doosre model par dobara chali jaati hai (`fallbacks: "default"`).

## 5. Code structure

```
src/agent.ts              chat loop + system prompt (Claude tool runner)
src/approval.ts           har post/send se pehle y/n confirmation
src/platforms/meta.ts     Facebook Page + Instagram tools
src/platforms/youtube.ts  YouTube tools
src/platforms/x.ts        X tools
src/platforms/linkedin.ts LinkedIn tools
```

Naya platform jodna ho to `src/platforms/` me naya file banao jo `betaZodTool` ki list return kare, aur use `agent.ts` me `tools` me add kar do.

**Tokens ko kabhi git me commit mat karna.** `.env` pehle se `.gitignore` me hai.
