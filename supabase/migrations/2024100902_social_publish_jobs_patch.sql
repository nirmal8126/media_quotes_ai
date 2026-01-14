-- Patch existing social publishing tables to align with new schema

-- Social accounts additions
alter table if exists public.social_accounts
  add column if not exists fb_user_id text,
  add column if not exists page_id text,
  add column if not exists page_name text,
  add column if not exists page_access_token_encrypted text,
  add column if not exists token_expires_at timestamptz;

create unique index if not exists social_accounts_user_platform_page_idx
  on public.social_accounts (user_id, platform, page_id);

-- Publish jobs additions
alter table if exists public.publish_jobs
  add column if not exists quote_id uuid,
  add column if not exists result_post_id text,
  add column if not exists error text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists status text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Backfill quote_id from legacy entity_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publish_jobs'
      AND column_name = 'entity_id'
  ) THEN
    EXECUTE 'update public.publish_jobs set quote_id = entity_id where quote_id is null and entity_id is not null';
  END IF;
END $$;

-- Ensure foreign key on quote_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'publish_jobs_quote_id_fkey'
  ) THEN
    ALTER TABLE public.publish_jobs
      ADD CONSTRAINT publish_jobs_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quotes (id) ON DELETE CASCADE;
  END IF;
END $$;

create index if not exists publish_jobs_status_schedule_idx on public.publish_jobs (status, scheduled_at);
create index if not exists publish_jobs_user_quote_idx on public.publish_jobs (user_id, quote_id);
create index if not exists publish_jobs_quote_idx on public.publish_jobs (quote_id);
create index if not exists publish_jobs_platform_idx on public.publish_jobs (platform);
