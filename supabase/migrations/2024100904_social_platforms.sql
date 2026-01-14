-- Social platform enablement
create table if not exists public.social_platforms (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  name text not null,
  overview text,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.social_platforms (platform, name, overview, enabled)
values
  ('facebook', 'Facebook', 'Connect a Facebook Page to publish quotes and media.', true),
  ('instagram', 'Instagram', 'Connect Instagram for image and reel publishing.', false),
  ('linkedin', 'LinkedIn', 'Post quotes and carousels to LinkedIn.', false),
  ('x', 'X (Twitter)', 'Share quotes to X with hashtags.', false),
  ('youtube', 'YouTube', 'Publish Shorts and captions to YouTube.', false),
  ('tiktok', 'TikTok', 'Publish short videos to TikTok.', false)
on conflict (platform) do nothing;
