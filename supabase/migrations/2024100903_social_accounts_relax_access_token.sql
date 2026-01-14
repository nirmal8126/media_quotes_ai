-- Relax legacy social_accounts access_token constraint for new encrypted storage

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_accounts'
      AND column_name = 'access_token'
  ) THEN
    EXECUTE 'alter table public.social_accounts alter column access_token drop not null';
  END IF;
END $$;
