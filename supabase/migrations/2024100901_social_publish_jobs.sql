-- Social accounts for connected publish platforms
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null,
  fb_user_id text,
  page_id text,
  page_name text,
  page_access_token_encrypted text,
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists social_accounts_user_platform_page_idx on public.social_accounts (user_id, platform, page_id);
create index if not exists social_accounts_platform_idx on public.social_accounts (platform);

-- Publish job queue
create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  status text not null default 'queued',
  scheduled_at timestamptz,
  result_post_id text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists publish_jobs_status_schedule_idx on public.publish_jobs (status, scheduled_at);
create index if not exists publish_jobs_user_quote_idx on public.publish_jobs (user_id, quote_id);
create index if not exists publish_jobs_quote_idx on public.publish_jobs (quote_id);
create index if not exists publish_jobs_platform_idx on public.publish_jobs (platform);
