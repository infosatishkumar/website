# Social Media Connector — Hostinger par launch kaise karein

Ye folder Hostinger shared hosting (Premium / Business plan) ke liye backend
hai: PHP + SQLite. Isme login, Facebook/Instagram connect, AI Agent (Claude)
aur scheduled posting shamil hai.

## 1. Zip banana (developer ke liye)

```bash
npm install
bash hostinger/build.sh   # → hostinger/dist/social-media-connector-hostinger.zip
```

## 2. Hostinger par upload

1. hPanel → **Websites → Manage → Advanced → PHP Configuration** → PHP **8.3**
   chuno. `max_execution_time` ko **300** kar do (agent ko kabhi 1 minute tak lagta hai).
2. **File Manager → public_html** me zip upload karke **Extract** karo, phir zip delete karo.
   "Show hidden files" on karke check karo ki `.htaccess` aa gayi hai.
3. **SSL** on hona chahiye (hPanel → Security → SSL). Meta login ke liye `https` zaroori hai.

## 3. Config file (sabse zaroori)

1. `smc-config.sample.php` ko `smc-config.php` naam se copy karo.
2. Isko **public_html ke bahar**, ek folder upar rakho:
   `/home/uXXXX/domains/aapkadomain.com/smc-config.php`
   (File Manager me `public_html` ke parent folder me).
3. Isme bharo:
   - `base_url` → `https://aapkadomain.com`
   - `admin_email`, `admin_password` → purana owner login (pehli baar login karte hi ye
     user #1 ban jata hai; naye log website par khud **Sign up** karte hain)
   - `smtp_pass` → `contact@satishkumar.net` mailbox ka password (step 3a)
   - `anthropic_api_key` → console.anthropic.com → API Keys se **nayi** key (`sk-ant-api03-…`)
   - `meta_app_id`, `meta_app_secret` → step 4 se
   - `cron_secret` → koi bhi lamba random text

Key kabhi bhi `public_html` ke andar, GitHub par, ya chat me mat daalna.

## 3a. Email verification (contact@satishkumar.net)

Sign up par user ko Gmail/inbox me **"Verify Email"** link jata hai; password reset aur
demo booking ke emails bhi isi se jate hain.

1. hPanel → **Emails** → domain `satishkumar.net` → mailbox `contact@satishkumar.net`
   bana lo (ya pehle se hai to uska password reset karke yaad rakho).
2. Config me: `smtp_host` = `smtp.hostinger.com`, `smtp_port` = `465`,
   `smtp_user` = `mail_from` = `contact@satishkumar.net`, `smtp_pass` = mailbox password.
3. Spam me na jaye isliye hPanel → Emails → **DNS / Email deliverability** me SPF, DKIM,
   DMARC "Connected" dikhne chahiye.
4. Test: `https://aapkadomain.com/api/health.php` kholo — "SMTP" wali line green honi chahiye.

## 4. Meta (Facebook + Instagram) app

1. developers.facebook.com → **My Apps → Create App** → use case
   "Other" → type **Business**.
2. **Facebook Login for Business** product add karo.
   - Valid OAuth Redirect URI: `https://aapkadomain.com/api/index.php?action=meta_callback`
3. **App settings → Basic** se App ID aur App Secret copy karke config me daalo.
   Privacy Policy URL aur app icon bhi bharo.
4. Instagram account **Business/Creator** hona chahiye aur kisi Facebook Page se linked.
5. Jab tak app "Development" mode me hai, sirf aap (app admin/tester) connect kar sakte ho —
   apne accounts ke liye itna kaafi hai. Doosre logon ke accounts ke liye **App Review** me ye
   permissions maango: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `business_management`, `instagram_basic`, `instagram_content_publish`.

## 5. Cron (scheduled posts ke liye)

hPanel → **Advanced → Cron Jobs** → har 5 minute:

```
/usr/bin/php /home/uXXXX/domains/aapkadomain.com/public_html/api/cron.php
```

## 6. Chalu karo

1. `https://aapkadomain.com/connector/app/` kholo → **Create an account** → email me
   aaya **Verify Email** dabao → seedha dashboard khul jayega. (Ya purane admin
   email/password se login.)
2. Top-right ☀/🌙 button se **Light / Dark mode** badlo.
3. **Accounts → Connect account → Facebook "Connect Page"** ya **Instagram "Connect
   Business or Creator"** → Meta Business Suite → Proceed → Facebook login →
   **Select accounts** screen par Pages/Instagram chuno → Connect account.
4. **Agent** me likho: "Diwali offer ka post bana do" (Instagram ke liye image attach karo).
   - Auto-publish OFF: post approval me rukegi → "Approve & publish now".
   - Auto-publish ON: agent seedha publish kar dega jab aap bolo.
5. **Create post → Generate with AI** (AI Pilot) se caption likhwao.
6. Marketing site par **Request demo** → calendar se slot book → dono ko email jata hai.

## Kya live hai, kya abhi demo

| Live (asli) | Abhi sample/demo |
|---|---|
| Sign up + email verification, password reset, demo booking, Login, AI Agent, AI Pilot, Facebook Page + Instagram posting, scheduling, calendar, approvals, bulk import, image upload | Analytics, reports, competitor, inbox (sample numbers); X/LinkedIn/TikTok/YouTube connect ("Coming soon") |
