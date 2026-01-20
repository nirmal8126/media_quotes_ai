alter table if exists public.social_accounts
  add column if not exists refresh_token_encrypted text;
