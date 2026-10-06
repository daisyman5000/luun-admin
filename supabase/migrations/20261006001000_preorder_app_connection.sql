create table public.preorder_app_connections (
 shop_domain text not null,
 client_id text not null,
 access_token text not null,
 scope text not null,
 installed_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key (shop_domain, client_id)
);
alter table public.preorder_app_connections enable row level security;
revoke all on public.preorder_app_connections from anon, authenticated;
grant all on public.preorder_app_connections to service_role;
