-- AI Videos schema (projects, scenes, media, voices, render jobs)
-- Run in Supabase SQL editor or psql (auth schema references Supabase auth.users)

create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  video_type text not null default 'shorts', -- shorts | longform
  content_format text, -- faceless | fake_text | split_screen | other
  input_mode text, -- topic | prompt | script
  topic text,
  prompt text,
  script text,
  language text default 'en',
  duration_seconds int,
  aspect_ratio text default '9:16',
  narrator_voice_id uuid, -- references video_voices.id (optional)
  status text not null default 'draft', -- draft | generating_script | editing | rendering | ready | failed
  settings jsonb, -- captions/music/template/options
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists video_projects_user_idx on public.video_projects (user_id, created_at desc);
create index if not exists video_projects_status_idx on public.video_projects (status);

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
  status text default 'pending', -- pending | ready | failed
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, scene_index)
);

create index if not exists video_scenes_project_idx on public.video_scenes (project_id);

create table if not exists public.scene_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  scene_id uuid references public.video_scenes (id) on delete cascade,
  media_type text not null, -- image | video | audio
  source text, -- ai_generated | upload | stock | gameplay | viral
  url text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists scene_media_project_idx on public.scene_media (project_id);
create index if not exists scene_media_scene_idx on public.scene_media (scene_id);

create table if not exists public.video_voices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  language text not null default 'en',
  gender text,
  tone text,
  provider text,
  provider_voice_id text,
  words_per_minute int,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists video_voices_lang_idx on public.video_voices (language, enabled);

create table if not exists public.video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  status text not null default 'queued', -- queued | processing | failed | completed
  preview_url text,
  output_url text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists video_render_jobs_project_idx on public.video_render_jobs (project_id, created_at desc);

-- updated_at triggers
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_video_projects_updated on public.video_projects;
create trigger trg_video_projects_updated
before update on public.video_projects
for each row execute function public.touch_updated_at();

drop trigger if exists trg_video_scenes_updated on public.video_scenes;
create trigger trg_video_scenes_updated
before update on public.video_scenes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_video_voices_updated on public.video_voices;
create trigger trg_video_voices_updated
before update on public.video_voices
for each row execute function public.touch_updated_at();

drop trigger if exists trg_video_render_jobs_updated on public.video_render_jobs;
create trigger trg_video_render_jobs_updated
before update on public.video_render_jobs
for each row execute function public.touch_updated_at();
