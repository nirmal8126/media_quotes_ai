-- Tables for AI Reels pipeline (scripts + reels)
-- Run in Supabase SQL editor or psql (auth schema references Supabase auth.users)

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null,
  platform text,
  tone text,
  style text,
  template text,
  brand_colors text[],
  brand_fonts text[],
  logo_url text,
  end_screen_template text,
  duration_sec int,
  input_prompt text,
  text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scripts_user_idx on public.scripts (user_id);

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  script_id uuid not null references public.scripts (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null,
  platform text,
  tone text,
  style text,
  template text,
  brand_colors text[],
  brand_fonts text[],
  logo_url text,
  end_screen_template text,
  audio_voice_id text,
  music_track_id text,
  trending_audio_id text,
  duration_sec int,
  status text default 'RENDERING',
  renderer_job_id text,
  video_url text,
  thumbnail_url text,
  error_message text,
  custom_settings jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reels_user_idx on public.reels (user_id);
create index if not exists reels_script_idx on public.reels (script_id);
create index if not exists reels_renderer_job_idx on public.reels (renderer_job_id);

-- Enums
do $$ begin
  create type public.platform as enum ('youtube_shorts', 'instagram_reels', 'tiktok');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_source as enum ('user_upload', 'stock', 'ai_generated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.safety_status as enum ('safe', 'warn', 'risk');
exception when duplicate_object then null; end $$;

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

-- Safety reports
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
  user_id uuid references auth.users (id) on delete cascade,
  status safety_status default 'safe',
  score int default 100,
  issues jsonb default '[]'::jsonb,
  fixes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists content_integrity_reports_user_idx on public.content_integrity_reports (user_id);
create index if not exists content_integrity_reports_content_idx on public.content_integrity_reports (content_id);
