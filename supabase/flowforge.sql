-- FlowForge storage: one JSON document table for workflows, runs,
-- connections (credentials are AES-GCM encrypted by the app) and OAuth state.
-- Run this once in the Supabase SQL editor.

create table if not exists public.flowforge_docs (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists flowforge_docs_collection_updated
  on public.flowforge_docs (collection, updated_at desc);

-- Only the server (service role key) may touch this table.
alter table public.flowforge_docs enable row level security;
revoke all on public.flowforge_docs from anon, authenticated;
