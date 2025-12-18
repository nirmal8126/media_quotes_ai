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
