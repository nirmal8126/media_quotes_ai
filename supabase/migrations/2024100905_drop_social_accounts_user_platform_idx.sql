-- Allow multiple pages per user/platform
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'social_accounts_user_platform_idx'
  ) THEN
    EXECUTE 'drop index public.social_accounts_user_platform_idx';
  END IF;
END $$;
