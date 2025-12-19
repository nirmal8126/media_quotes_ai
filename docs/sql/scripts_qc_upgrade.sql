-- Migration: scripts QC + metadata upgrades (idempotent)

-- Add new columns to scripts
alter table if exists public.scripts
  add column if not exists topic_hash text,
  add column if not exists module text default 'scripts',
  add column if not exists output_json jsonb,
  add column if not exists caption text,
  add column if not exists qc jsonb;

-- Optional: backfill module to 'scripts' where null
update public.scripts set module = 'scripts' where module is null;

-- Notify PostgREST to reload schema
select pg_notify('pgrst', 'reload schema');
