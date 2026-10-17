# Hostinger par deploy kaise karein

Ye Next.js app hai (FlowForge ke API routes ke saath), isliye ise **Node.js web app**
ke roop mein deploy karna hoga. Normal "upload to public_html" wala shared hosting
yahan kaam nahi karega.

**Plan chahiye:** Business Web Hosting, ya koi Cloud plan (Startup / Professional /
Enterprise) — inhi mein "Node.js web app" option aata hai. VPS bhi chalega.

## 1. Database (ek baar)

1. [supabase.com](https://supabase.com) par project kholo (pehle se hai to wahi).
2. **SQL Editor** mein `supabase/flowforge.sql` ka pura content chala do.
3. **Project Settings → API** se ye teen cheezein copy karo:
   `Project URL`, `anon public key`, `service_role key`.

## 2. Hostinger par app banao

1. hPanel → **Websites → Add Website → Node.js web app**.
2. **Upload your files** chuno aur `flowforge-website.zip` upload karo.
   (Agar domain pehle se kisi website ke liye add hai, to pehle wo website hatani padegi.)
3. Build settings check karo:
   - Node.js version: **22.x** (ya 20.x / 24.x)
   - Root directory: `/` (khaali)
   - Install: `npm install` (auto)
   - Build command: `npm run build`
   - Start command: `npm start`
   - Output directory: `.next`

## 3. Environment variables

Deploy se pehle (ya baad mein app settings → Environment variables) ye daalo:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret!) |
| `FLOWFORGE_ADMIN_PASSWORD` | FlowForge login password |
| `FLOWFORGE_SECRET` | koi bhi 40+ character random string — **baad mein kabhi mat badalna** |
| `CRON_SECRET` | ek aur random string |
| `FLOWFORGE_APP_URL` | `https://aapkadomain.com` |

Random string banane ke liye: <https://www.random.org/strings/> ya terminal mein
`openssl rand -base64 32`.

Social media OAuth keys (`META_APP_ID`, `LINKEDIN_CLIENT_ID`, `X_CLIENT_ID`, …)
baad mein jab chahiye tab add karo — poori list `.env.example` mein hai.
Har env var change ke baad **Redeploy** dabana zaroori hai.

Phir **Deploy** dabao. 2–5 minute mein site live ho jayegi.

## 4. Check karo

- `https://aapkadomain.com` → portfolio site
- `https://aapkadomain.com/flowforge` → FlowForge login (password = `FLOWFORGE_ADMIN_PASSWORD`)
- FlowForge → **Setup** page par saare points green hone chahiye.

## 5. Cron (Schedule aur RSS triggers ke liye)

1. [cron-job.org](https://cron-job.org) par free account banao → **Create cronjob**.
2. URL: `https://aapkadomain.com/api/flowforge/cron?key=AAPKA_CRON_SECRET`
3. Schedule: **every 5 minutes** → Save.

## 6. Social accounts connect karna

- **Turant (token paste karo):** Telegram, Bluesky, Mastodon, Discord, Slack,
  WhatsApp, Email (Resend), Notion, Airtable, Claude.
- **Ek baar developer app banana padega:** Facebook, Instagram, Threads, LinkedIn,
  X, Pinterest, Google Sheets. FlowForge → Integrations → Connect par har platform
  ka step-by-step guide aur exact **redirect URL** dikhta hai. Wo URL platform ke
  developer console mein daalo, keys Hostinger env vars mein daalo, Redeploy karo.

## Update kaise karein

Code badalne par naya zip upload karke Redeploy karo — ya hPanel mein GitHub repo
(`infosatishkumar/website`) connect kar do, phir har push par auto-deploy hoga.

## Dikkat aaye to

- **Homepage par error:** Supabase ke `NEXT_PUBLIC_SUPABASE_*` vars missing hain.
- **FlowForge "locked" dikhaye:** `FLOWFORGE_ADMIN_PASSWORD` / `FLOWFORGE_SECRET` set karke Redeploy karo.
- **Data gayab ho jata hai redeploy par:** `SUPABASE_SERVICE_ROLE_KEY` set nahi hai
  (tab data local file mein jaata hai jo redeploy par mit sakta hai).
- **Build fail:** Node version 20 ya usse upar rakho.
