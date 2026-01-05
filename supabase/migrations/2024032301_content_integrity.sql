-- Content Integrity System (Supabase migration)
-- Safe to re-run; uses IF NOT EXISTS guards for idempotency.

-- Enums
do $$ begin
  create type public.platform as enum ('youtube_shorts', 'instagram_reels', 'tiktok', 'generic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_source as enum ('user_upload', 'stock', 'ai_generated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.safety_status as enum ('safe', 'warn', 'risk');
exception when duplicate_object then null; end $$;

-- Core reels/script columns frequently referenced by the app
alter table if exists public.scripts add column if not exists template text;
alter table if exists public.scripts add column if not exists brand_colors text[];
alter table if exists public.scripts add column if not exists brand_fonts text[];
alter table if exists public.scripts add column if not exists logo_url text;
alter table if exists public.scripts add column if not exists end_screen_template text;

alter table if exists public.reels add column if not exists template text;
alter table if exists public.reels add column if not exists brand_colors text[];
alter table if exists public.reels add column if not exists brand_fonts text[];
alter table if exists public.reels add column if not exists logo_url text;
alter table if exists public.reels add column if not exists end_screen_template text;
alter table if exists public.reels add column if not exists audio_voice_id text;
alter table if exists public.reels add column if not exists music_track_id text;
alter table if exists public.reels add column if not exists trending_audio_id text;
alter table if exists public.reels add column if not exists custom_settings jsonb;

-- Versioned scripts / variants
create table if not exists public.reel_versions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  version_label text not null default 'v1',
  script text not null,
  similarity_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reel_versions_reel_idx on public.reel_versions (reel_id);

-- Media assets linked to reels
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  asset_type text,
  source asset_source default 'user_upload',
  url text not null,
  license text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists assets_reel_idx on public.assets (reel_id);

-- Audio tracks metadata
create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  source asset_source default 'user_upload',
  license_type text,
  platform_constraints jsonb,
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists audio_tracks_reel_idx on public.audio_tracks (reel_id);

-- Caption/cue metadata
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  cues jsonb,
  created_at timestamptz default now()
);
create index if not exists captions_reel_idx on public.captions (reel_id);

-- Export tracking
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  status text default 'pending',
  output_url text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists exports_reel_idx on public.exports (reel_id);

-- Safety reports (renderer safety)
create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  status safety_status default 'safe',
  score int default 100,
  reasons jsonb default '[]'::jsonb,
  suggested_fixes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists safety_reports_reel_idx on public.safety_reports (reel_id);

-- Unified content integrity reports (cross-module)
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

-- Generic content versions (scripts, quotes, reels, captions)
create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  version_name text default 'v1',
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists cv_content_idx on public.content_versions (content_id, content_type);

-- Optional pointers from existing tables to integrity reports
alter table if exists public.reels add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
alter table if exists public.scripts add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
alter table if exists public.quotes add column if not exists integrity_report_id uuid references public.content_integrity_reports (id);
