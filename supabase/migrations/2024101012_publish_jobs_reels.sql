-- Allow reel publish jobs in the queue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publish_jobs'
      AND column_name = 'quote_id'
  ) THEN
    EXECUTE 'alter table public.publish_jobs alter column quote_id drop not null';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publish_jobs'
      AND column_name = 'reel_id'
  ) THEN
    EXECUTE 'alter table public.publish_jobs add column reel_id uuid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'publish_jobs_reel_id_fkey'
  ) THEN
    ALTER TABLE public.publish_jobs
      ADD CONSTRAINT publish_jobs_reel_id_fkey
      FOREIGN KEY (reel_id) REFERENCES public.reels (id) ON DELETE CASCADE;
  END IF;
END $$;

create index if not exists publish_jobs_reel_idx on public.publish_jobs (reel_id);
