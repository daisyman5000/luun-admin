create table if not exists public.shopify_connections (
  shop_domain text primary key,
  access_token text not null,
  scope text,
  installed_by uuid references auth.users(id) on delete set null,
  installed_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_shopify_connections_updated_at on public.shopify_connections;
create trigger set_shopify_connections_updated_at
before update on public.shopify_connections
for each row execute function public.set_updated_at();

alter table public.shopify_connections enable row level security;

revoke all on public.shopify_connections from anon, authenticated;
