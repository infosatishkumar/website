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
