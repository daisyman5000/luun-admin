alter table public.preorder_app_connections
 add column plan_group_id text,
 add column plan_ids jsonb not null default '{}'::jsonb,
 add column plan_setup_state text check (plan_setup_state in ('creating','ready'));
