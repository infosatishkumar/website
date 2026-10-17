# Satish Kumar — Portfolio

Personal portfolio site built with Next.js (App Router), Tailwind CSS, and
Supabase as the database. Deploys on Vercel.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase (Postgres)
- **Hosting:** Vercel

## Data model

Three tables live in Supabase, defined in the `portfolio_schema` migration:

- `projects` — portfolio items (title, description, tags, links, featured flag)
- `blog_posts` — blog content (title, slug, content, published state)
- `contact_messages` — submissions from the `/contact` form

Row Level Security is enabled on all three tables:

- Anyone can read `projects` and `blog_posts` rows where `published = true`.
- Anyone can `insert` into `contact_messages` (the contact form), but nobody
  can read/update/delete from the client — use the Supabase dashboard or the
  service role key for that.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable                        | Description                        |
| -------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Your Supabase project URL           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Your Supabase anon/publishable key  |

Set the same variables in the Vercel project's Environment Variables settings
for production/preview deployments.

## Adding content

Insert rows into `projects` and `blog_posts` via the Supabase dashboard's
Table Editor (or SQL editor) with `published = true` to have them appear on
the site.

---

# FlowForge — workflow automation at `/flowforge`

A Zapier-style automation app built into this site: triggers → filters →
actions across social, messaging and productivity apps, with real API calls,
encrypted credential storage, webhooks, schedules, RSS polling and run history.

## What's included

| Kind | Apps |
| --- | --- |
| Triggers | Webhook (JSON/form), Schedule (every N min), RSS/Atom feed (blogs, YouTube), Telegram bot message |
| Social | Facebook Pages, Instagram, Threads, LinkedIn, X, Pinterest (OAuth) · Bluesky, Mastodon (token) |
| Messaging | Telegram, WhatsApp Cloud API, Discord, Slack, Email (Resend) |
| Productivity | Google Sheets (OAuth), Notion, Airtable |
| Logic & AI | Filter, Formatter, HTTP Request (any API), Claude AI text generation |

Step fields accept `{{variables}}`: `{{trigger.email}}`, `{{steps.2.text}}`
(output of step 2), `{{now}}`, `{{today}}`.

## Setup

1. **Database** – run `supabase/flowforge.sql` in the Supabase SQL editor and
   set `SUPABASE_SERVICE_ROLE_KEY`. Without it, data goes to `.flowforge/data.json`
   (fine locally, not persistent on Vercel).
2. **Security** – set `FLOWFORGE_ADMIN_PASSWORD` and a long random
   `FLOWFORGE_SECRET` (encrypts credentials; don't change it later).
   Locally, with no password set, `/flowforge` is open.
3. **Cron** – set `CRON_SECRET`, then have a scheduler (cron-job.org, GitHub
   Actions, Vercel Cron on Pro) call `GET /api/flowforge/cron` every 5 minutes
   with `Authorization: Bearer $CRON_SECRET`. Needed only for Schedule and RSS
   triggers. The Setup page also has a "run now" button.
4. **Token apps** (Telegram, Bluesky, Mastodon, Discord, Slack, WhatsApp,
   Resend, Notion, Airtable, Claude) connect instantly from *Integrations* —
   the credentials are verified live before being saved.
5. **OAuth apps** need a developer app per platform once. Add the IDs/secrets
   from `.env.example` (`META_APP_ID`, `LINKEDIN_CLIENT_ID`, `X_CLIENT_ID`, …)
   and register the redirect URL shown in *Integrations → Connect*
   (`https://<your-domain>/api/flowforge/oauth/<provider>/callback`).
   After that, any account connects with one click.

Platform notes: Meta (Facebook/Instagram/Threads) needs App Review before
accounts other than the app's admins/testers can connect; X posting is billed
per post on its pay-per-use plan; WhatsApp free-form text only works within 24h
of the customer's last message (use templates otherwise).

## Architecture

- `src/lib/flowforge/catalog.ts` – app/trigger/action definitions (drives the UI)
- `src/lib/flowforge/apps.ts` – action executors and credential checks
- `src/lib/flowforge/oauth.ts` – per-provider OAuth + token refresh
- `src/lib/flowforge/engine.ts` – runs steps, templating, run records
- `src/lib/flowforge/triggers.ts` – cron tick (schedules, RSS), Telegram webhook sync
- `src/lib/flowforge/store.ts` – Supabase or local-file document store
- `src/app/api/flowforge/*` – route handlers (state, workflows, hooks, oauth, cron)
- `src/app/flowforge/*` – the dashboard UI
