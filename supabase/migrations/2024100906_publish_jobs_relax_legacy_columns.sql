-- Allow new quote_id-based publish jobs without legacy entity columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publish_jobs'
      AND column_name = 'entity_type'
  ) THEN
    EXECUTE 'alter table public.publish_jobs alter column entity_type drop not null';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publish_jobs'
      AND column_name = 'entity_id'
  ) THEN
    EXECUTE 'alter table public.publish_jobs alter column entity_id drop not null';
  END IF;
END $$;
