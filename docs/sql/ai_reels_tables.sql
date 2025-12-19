-- AI Reels core tables (scripts + reels) with brand/audio/template fields.
-- Idempotent and tolerant of partial existing schemas (adds missing columns/indexes).

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Base tables (minimal columns so the file works even if channels/personas tables are absent)
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  tone text,
  text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  script_id uuid,
  platform text,
  tone text,
  status text default 'generated',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add optional columns if missing (skip foreign key constraints to avoid dependency errors)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='channel_id') then
    alter table public.scripts add column channel_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='persona_id') then
    alter table public.scripts add column persona_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='style') then
    alter table public.scripts add column style text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='template') then
    alter table public.scripts add column template text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='brand_colors') then
    alter table public.scripts add column brand_colors text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='brand_fonts') then
    alter table public.scripts add column brand_fonts text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='logo_url') then
    alter table public.scripts add column logo_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='end_screen_template') then
    alter table public.scripts add column end_screen_template text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='audio_voice_id') then
    alter table public.scripts add column audio_voice_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='music_track_id') then
    alter table public.scripts add column music_track_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='trending_audio_id') then
    alter table public.scripts add column trending_audio_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='duration_sec') then
    alter table public.scripts add column duration_sec int;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='scripts' and column_name='input_prompt') then
    alter table public.scripts add column input_prompt text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='channel_id') then
    alter table public.reels add column channel_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='persona_id') then
    alter table public.reels add column persona_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='style') then
    alter table public.reels add column style text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='template') then
    alter table public.reels add column template text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='brand_colors') then
    alter table public.reels add column brand_colors text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='brand_fonts') then
    alter table public.reels add column brand_fonts text[];
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='logo_url') then
    alter table public.reels add column logo_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='end_screen_template') then
    alter table public.reels add column end_screen_template text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='audio_voice_id') then
    alter table public.reels add column audio_voice_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='music_track_id') then
    alter table public.reels add column music_track_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='trending_audio_id') then
    alter table public.reels add column trending_audio_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='duration_sec') then
    alter table public.reels add column duration_sec int;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='renderer_job_id') then
    alter table public.reels add column renderer_job_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='video_url') then
    alter table public.reels add column video_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='thumbnail_url') then
    alter table public.reels add column thumbnail_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='reels' and column_name='error_message') then
    alter table public.reels add column error_message text;
  end if;
end $$;

-- Create indexes only when columns exist
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='scripts' and column_name='user_id') then
    execute 'create index if not exists scripts_user_idx on public.scripts (user_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_name='scripts' and column_name='channel_id') then
    execute 'create index if not exists scripts_channel_idx on public.scripts (channel_id)';
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_name='reels' and column_name='user_id') then
    execute 'create index if not exists reels_user_idx on public.reels (user_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_name='reels' and column_name='script_id') then
    execute 'create index if not exists reels_script_idx on public.reels (script_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_name='reels' and column_name='renderer_job_id') then
    execute 'create index if not exists reels_renderer_job_idx on public.reels (renderer_job_id)';
  end if;
end $$;
