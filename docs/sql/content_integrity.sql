-- Content Integrity tables (cross-module) for quotes/scripts/captions/reels/videos

do $$ begin
  create type public.platform as enum ('youtube_shorts', 'instagram_reels', 'tiktok', 'generic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.safety_status as enum ('safe', 'warn', 'risk');
exception when duplicate_object then null; end $$;

create table if not exists public.content_integrity_reports (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  platform platform default 'generic',
  user_id uuid references auth.users (id) on delete cascade,
  status safety_status default 'safe',
  score int default 100,
  issues jsonb default '[]'::jsonb,
  fixes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists cir_user_idx on public.content_integrity_reports (user_id);
create index if not exists cir_content_idx on public.content_integrity_reports (content_id, content_type);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  version_name text default 'v1',
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists cv_content_idx on public.content_versions (content_id, content_type);

alter table if exists public.reels add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
alter table if exists public.scripts add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
alter table if exists public.quotes add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
