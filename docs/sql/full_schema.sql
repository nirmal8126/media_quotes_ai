-- MediaQuotes AI Supabase Schema (full)
-- Idempotent: uses IF NOT EXISTS and guards so it can be re-run safely.

create extension if not exists "pgcrypto";

-- ========================
-- Core reference tables
-- ========================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null,
  reels_per_month int not null,
  perks jsonb,
  created_at timestamptz default now()
);
create unique index if not exists plans_name_ci_idx on public.plans (lower(name));

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  plan_tier text,
  plan_id uuid references public.plans (id),
  status text,
  quota_used int default 0,
  next_auto_generation timestamptz,
  created_at timestamptz default now()
);
create index if not exists users_plan_idx on public.users (plan_tier);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null,
  provider_subscription_id text,
  plan_tier text not null,
  plan_id uuid references public.plans (id),
  status text not null,
  valid_until timestamptz,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Reinforce plan_id columns in case schema cache lags
alter table if exists public.users add column if not exists plan_id uuid references public.plans (id);
alter table if exists public.subscriptions add column if not exists plan_id uuid references public.plans (id);

do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='plan_id'
  ) then
    create index if not exists users_plan_id_idx on public.users (plan_id);
  end if;
  if exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan_id'
  ) then
    create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);
  end if;
end
$$;
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.plan_quota_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_tier text not null,
  quota_limit int not null,
  quota_used int not null,
  window_start timestamptz,
  window_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  action_description text,
  plan_tier text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.default_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create unique index if not exists default_platforms_name_ci_idx on public.default_platforms (lower(name));

create table if not exists public.default_niches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create unique index if not exists default_niches_name_ci_idx on public.default_niches (lower(name));

create table if not exists public.default_formats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create unique index if not exists default_formats_name_ci_idx on public.default_formats (lower(name));

create table if not exists public.default_tones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create unique index if not exists default_tones_name_ci_idx on public.default_tones (lower(name));

-- ========================
-- Personas & Channels
-- ========================
create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  description text,
  tone text,
  language text,
  tags text[],
  created_at timestamptz default now()
);
create index if not exists personas_user_idx on public.personas (user_id);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  platform text,
  handle text,
  persona_id uuid references public.personas (id) on delete set null,
  tone text,
  style text,
  topic text,
  character_name text,
  character_images text[],
  logo_url text,
  audience text,
  content_type text,
  language text,
  style_rules text,
  visual_style text,
  posting_frequency text,
  brand_colors text[],
  brand_fonts text[],
  end_screen_template text,
  duration_default int,
  cta_default text,
  base_hashtags text[],
  defaults jsonb,
  auto_generate boolean default false,
  auto_generate_count int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists channels_user_idx on public.channels (user_id);

create table if not exists public.channel_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  idea text not null,
  source text,
  tags text[],
  created_at timestamptz default now()
);
create index if not exists channel_ideas_channel_idx on public.channel_ideas (channel_id);

-- ========================
-- Scripts & Reels
-- ========================
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete set null,
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
  input_prompt text,
  text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists scripts_user_idx on public.scripts (user_id);
create index if not exists scripts_channel_idx on public.scripts (channel_id);

-- Ensure text column exists and is not null (for environments where schema cache lags)
alter table if exists public.scripts
  add column if not exists text text;

update public.scripts
  set text = coalesce(text, input_prompt, '')
  where text is null;

alter table if exists public.scripts
  alter column text set not null;

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  script_id uuid not null references public.scripts (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete set null,
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
  status text default 'generated',
  renderer_job_id text,
  video_url text,
  thumbnail_url text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reels_user_idx on public.reels (user_id);
create index if not exists reels_script_idx on public.reels (script_id);
create index if not exists reels_renderer_job_idx on public.reels (renderer_job_id);

create table if not exists public.reel_versions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  version_label text not null default 'v1',
  script text not null,
  similarity_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reel_versions_reel_idx on public.reel_versions (reel_id);

-- ========================
-- Planner / Calendar
-- ========================
create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete set null,
  reel_id uuid references public.reels (id) on delete set null,
  scheduled_date date,
  best_time text,
  status text,
  platform text,
  created_at timestamptz default now()
);
create index if not exists content_calendar_user_idx on public.content_calendar (user_id);

-- ========================
-- Quotes
-- ========================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  topic text,
  persona text,
  tone text,
  language text,
  style text,
  quote_type text,
  quotes text[],
  image_quotes jsonb,
  hook text,
  word_limit int,
  integrity_report_id uuid,
  created_at timestamptz default now()
);
create index if not exists quotes_user_idx on public.quotes (user_id);

-- ========================
-- Assets / Media / Integrity
-- ========================
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'asset_source') then
    create type public.asset_source as enum ('user_upload', 'stock', 'ai_generated');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'safety_status') then
    create type public.safety_status as enum ('safe', 'warn', 'risk');
  end if;
end
$$;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  asset_type text,
  source public.asset_source default 'user_upload',
  url text not null,
  license text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists assets_reel_idx on public.assets (reel_id);

create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  source public.asset_source default 'user_upload',
  license_type text,
  platform_constraints jsonb,
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists audio_tracks_reel_idx on public.audio_tracks (reel_id);

create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  cues jsonb,
  created_at timestamptz default now()
);
create index if not exists captions_reel_idx on public.captions (reel_id);

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

create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references public.reels (id) on delete cascade,
  status public.safety_status default 'safe',
  score int default 100,
  reasons jsonb default '[]'::jsonb,
  suggested_fixes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists safety_reports_reel_idx on public.safety_reports (reel_id);

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'platform') then
    create type public.platform as enum ('youtube_shorts', 'instagram_reels', 'tiktok', 'generic');
  end if;
end
$$;

create table if not exists public.content_integrity_reports (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  platform public.platform default 'generic',
  content_uuid uuid,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.safety_status default 'safe',
  score int default 100,
  issues jsonb default '[]'::jsonb,
  fixes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists cir_user_idx on public.content_integrity_reports (user_id);
create index if not exists cir_content_idx on public.content_integrity_reports (content_id, content_type);
alter table if exists public.content_integrity_reports add column if not exists content_uuid uuid;
create index if not exists cir_content_uuid_idx on public.content_integrity_reports (content_uuid);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text not null,
  version_name text default 'v1',
  content_uuid uuid,
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists cv_content_idx on public.content_versions (content_id, content_type);
alter table if exists public.content_versions add column if not exists content_uuid uuid;
create index if not exists content_versions_content_uuid_idx on public.content_versions (content_uuid);

-- ========================
-- Social tokens (Facebook)
-- ========================
create table if not exists public.social_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  access_token_enc bytea,
  refresh_token_enc bytea,
  expires_at timestamptz,
  page_id text,
  page_access_token text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists social_tokens_user_provider_idx on public.social_tokens (user_id, provider);

-- ========================
-- Video module (AI videos)
-- ========================
create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  video_type text default 'shorts',
  content_format text,
  input_mode text,
  topic text,
  prompt text,
  script text,
  language text,
  duration_seconds int,
  aspect_ratio text default '9:16',
  narrator_voice_id text,
  status text default 'draft',
  settings jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists video_projects_user_idx on public.video_projects (user_id);

create table if not exists public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  scene_index int not null,
  label text,
  script text,
  prompt text,
  duration_ms int,
  image_url text,
  video_url text,
  status text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, scene_index)
);
create index if not exists video_scenes_project_idx on public.video_scenes (project_id);

create table if not exists public.scene_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  scene_id uuid references public.video_scenes (id) on delete set null,
  media_type text not null,
  source text,
  url text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists scene_media_project_idx on public.scene_media (project_id);

create table if not exists public.video_voices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  language text not null,
  gender text,
  tone text,
  provider text,
  provider_voice_id text,
  words_per_minute int,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Unique voice per provider
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'video_voices' and column_name = 'provider'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'video_voices' and column_name = 'provider_voice_id'
  ) then
    create unique index if not exists video_voices_provider_voice_id_uidx
      on public.video_voices (provider, provider_voice_id);
  end if;
end
$$;

create table if not exists public.video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  status text default 'queued',
  preview_url text,
  output_url text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists video_render_jobs_project_idx on public.video_render_jobs (project_id);

-- ========================
-- Auto-updated updated_at trigger
-- ========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select t.table_schema, t.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.column_name = 'updated_at'
      and t.table_schema = 'public'
      and t.table_name in (
        'channels','scripts','reels','reel_versions','assets','audio_tracks','exports',
        'video_projects','video_scenes','video_render_jobs','video_voices'
      )
      and t.table_type = 'BASE TABLE'
  loop
    execute format('drop trigger if exists set_updated_at_%I on %I.%I', r.table_name, r.table_schema, r.table_name);
    execute format(
      'create trigger set_updated_at_%I before update on %I.%I for each row execute procedure public.set_updated_at()',
      r.table_name, r.table_schema, r.table_name
    );
  end loop;
end
$$;
