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

## 3. Config file (sirf ek baar, chhota sa)

> Meta App ID/Secret, Claude key aur email password ab **website se** daalte hain:
> login karke left me **Settings → Platform settings**. Config file me sirf `base_url`,
> `admin_email`, `admin_password` aur `cron_secret` kaafi hai.

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

Ye **sirf site owner ek baar** karta hai (jaise SocialPilot ka apna Meta app hota hai).
Public users ko kuch nahi karna — wo bas **Connect Page** dabake apne Facebook se login karte hain.
Platform settings page par saare URLs "Copy" button ke saath dikhte hain.

1. developers.facebook.com → **My Apps → Create App** → use case
   "Other" → type **Business**.
2. **Facebook Login for Business** product add karo.
   - Valid OAuth Redirect URI: `https://aapkadomain.com/api/oauth.php`
3. **App settings → Basic** se App ID aur App Secret copy karke config me daalo.
   Privacy Policy URL aur app icon bhi bharo.
4. Instagram account **Business/Creator** hona chahiye aur kisi Facebook Page se linked.
5. Jab tak app "Development" mode me hai, sirf aap (app admin/tester) connect kar sakte ho —
   apne accounts ke liye itna kaafi hai. Doosre logon ke accounts ke liye **App Review** me ye
   permissions maango: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `business_management`, `instagram_basic`, `instagram_content_publish`.

## 4a. Baaki networks (LinkedIn, X, YouTube, Google Business, Pinterest, TikTok, Threads, Instagram direct)

Har network ka apna developer app hota hai (ek baar, sirf owner). **Settings → Platform settings**
me har network ki row kholo → "Open developer portal" → app banao → Client ID / Secret wahan paste karo.
Sab apps me **ek hi Callback URL**: `https://aapkadomain.com/api/oauth.php`

- **Bluesky**: koi app nahi chahiye — user apna handle + app password daalke turant connect.
- **YouTube** ke liye post me MP4 video chahiye; **Pinterest** ko image; **TikTok** ko photo/video.
- Videos 200 MB tak: hPanel → PHP Configuration me `upload_max_filesize` aur `post_max_size` = 256M.
- Har network public users ke liye kholne se pehle apna review/approval maangta hai
  (Meta App Review, LinkedIn Community Management, TikTok audit, Google verification).

## 4b. Payments (UPI)

- Pricing page par **Buy now · pay by UPI** → user ko QR milta hai jisme plan ka amount pehle se bhara hota hai
  (mobile par "Pay in UPI app" button seedha PhonePe/GPay kholta hai).
- User payment ke baad **UTR / UPI Ref No.** daalta hai. Aapko email aata hai.
- Profile menu → **Payments**: apne UPI app ki History me wahi UTR milao → **Approve** → plan turant chalu
  (zyada AI credits). Reject karne par user ko email jata hai.
- UPI ID aur naam: Settings → Platform settings → **UPI payments** (default `infosatish.in2@ybl`).
- Bina approve kiye apne aap confirm karne ke liye payment gateway (Razorpay / PhonePe PG) lagana padega.

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
| Sign up + email verification, password reset, demo booking, Login, AI Agent, AI Pilot, Facebook, Instagram, LinkedIn, X, YouTube, Google Business, Pinterest, TikTok, Threads, Bluesky posting, scheduling, calendar, approvals, bulk import, image upload | Analytics, reports, competitor, inbox (sample numbers) |
