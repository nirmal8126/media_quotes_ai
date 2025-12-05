-- Create table to store OAuth tokens for social providers (Facebook, Instagram, etc.)
create table if not exists social_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  page_id text,
  page_access_token text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists social_tokens_user_idx on social_tokens (user_id, provider);
