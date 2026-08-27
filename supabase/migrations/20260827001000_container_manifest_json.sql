alter table public.container_entries
add column if not exists manifest_json jsonb default '[]'::jsonb;
