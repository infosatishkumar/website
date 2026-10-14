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

## Social Media Connector (`/connector`)

A social media management product (SocialPilot-style feature set) with a
Hostinger-inspired design system: purple primary `#673DE6`, near-black
`#1D1E20`, lavender tints, DM Sans, 8px-radius bold buttons.

The app is split into two route groups with their own root layouts, so the
portfolio and the product never share styles:

- `src/app/(portfolio)` — the original portfolio site
- `src/app/(connector)` — the product (`connector.css` holds the design tokens)

### Marketing site — `/connector`

Home, Reviews, Listings, Pricing (`/plans`, `/listings/plans`), All features
and a page per feature, Solutions (audiences, industries, networks),
Resources, Help Center with demo request, Video tutorials, Webinars and
Customer stories. Header has the Platform / Solutions / Resources mega menus
and a support chat widget.

Videos: every "Watch demo" / tutorial opens an animated product walkthrough
(`DemoPlayer`). Add a `youtubeId` to an item in `src/lib/connector/data.ts`
to embed a real recording instead.

### Dashboard — `/connector/app`

Launchpad, Create post (AI Pilot captions, per-network limits and preview,
schedule / queue / approval / draft), Calendar (list, day, week, month,
drag to reschedule), Bulk CSV import, Approvals, Queue times, Content bank,
Accounts + Connect account, Groups, Network analytics
(`/analytics/{X,facebook,instagram,linkedin,gmb,youtube,tiktok}`), Reports
(print to PDF), Competitors, Inbox, Library, RSS feeds, Tags, UTM presets,
Custom fields and Mention groups.

The dashboard is a front-end preview: workspace data is stored in the
browser (`src/lib/connector/store.ts`), account connection simulates OAuth,
and analytics show sample numbers. Publishing for real needs a backend with
each network's API credentials.

Brand assets live in `src/components/connector/`: `Logo.tsx` (the "C" +
share-graph mark), `Icon.tsx` (custom outline icon set) and `SocialIcon.tsx`.
