create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'viewer' check (role in ('owner', 'admin', 'logistics', 'viewer')),
  created_at timestamptz default now()
);

create table if not exists public.shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique,
  order_number text,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_price numeric,
  currency text,
  payment_status text,
  fulfillment_status text,
  shipping_address_json jsonb,
  fabric_slug text,
  delegate_order_id text,
  postal_code text,
  carrier text,
  delegate_order_created_at text,
  delivered_at text,
  delivery_status text,
  action_needed text,
  corner_qty integer default 0,
  armless_qty integer default 0,
  ottoman_qty integer default 0,
  total_modules integer default 0,
  logistics_status text default 'new',
  internal_notes text,
  raw_shopify_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  fabric_slug text,
  module_slug text,
  available_qty integer default 0,
  reserved_qty integer default 0,
  incoming_qty integer default 0,
  low_stock_threshold integer default 3,
  builder_visible boolean default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  unique (fabric_slug, module_slug)
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  fabric_slug text,
  module_slug text,
  delta_available integer default 0,
  delta_reserved integer default 0,
  delta_incoming integer default 0,
  reason text,
  source text,
  related_shopify_order_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists shopify_orders_order_number_idx on public.shopify_orders (order_number);
create index if not exists shopify_orders_logistics_status_idx on public.shopify_orders (logistics_status);
create index if not exists shopify_orders_fulfillment_status_idx on public.shopify_orders (fulfillment_status);
create index if not exists inventory_builder_visible_idx on public.inventory (builder_visible);
create index if not exists inventory_fabric_module_idx on public.inventory (fabric_slug, module_slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_shopify_orders_updated_at on public.shopify_orders;
create trigger set_shopify_orders_updated_at
before update on public.shopify_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

create or replace function public.set_inventory_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_inventory_updated_by on public.inventory;
create trigger set_inventory_updated_by
before update on public.inventory
for each row execute function public.set_inventory_updated_by();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(allowed_roles), false)
$$;

alter table public.profiles enable row level security;
alter table public.shopify_orders enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_adjustments enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Owner and admin can read profiles" on public.profiles;
create policy "Owner and admin can read profiles"
on public.profiles for select
to authenticated
using (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Owner and admin can insert profiles" on public.profiles;
create policy "Owner and admin can insert profiles"
on public.profiles for insert
to authenticated
with check (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Owner and admin can update profiles" on public.profiles;
create policy "Owner and admin can update profiles"
on public.profiles for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin']))
with check (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Owner and admin can delete profiles" on public.profiles;
create policy "Owner and admin can delete profiles"
on public.profiles for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Authenticated users can read shopify orders" on public.shopify_orders;
create policy "Authenticated users can read shopify orders"
on public.shopify_orders for select
to authenticated
using (true);

drop policy if exists "Logistics roles can update order logistics fields" on public.shopify_orders;
create policy "Logistics roles can update order logistics fields"
on public.shopify_orders for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Authenticated users can read inventory" on public.inventory;
create policy "Authenticated users can read inventory"
on public.inventory for select
to authenticated
using (true);

drop policy if exists "Owner and admin can update inventory" on public.inventory;
create policy "Owner and admin can update inventory"
on public.inventory for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin']))
with check (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Owner and admin can insert inventory" on public.inventory;
create policy "Owner and admin can insert inventory"
on public.inventory for insert
to authenticated
with check (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Owner and admin can delete inventory" on public.inventory;
create policy "Owner and admin can delete inventory"
on public.inventory for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin']));

drop policy if exists "Authenticated users can read inventory adjustments" on public.inventory_adjustments;
create policy "Authenticated users can read inventory adjustments"
on public.inventory_adjustments for select
to authenticated
using (true);

drop policy if exists "Staff can create inventory adjustments" on public.inventory_adjustments;
create policy "Staff can create inventory adjustments"
on public.inventory_adjustments for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.shopify_orders from anon, authenticated;
revoke all on public.inventory from anon, authenticated;
revoke all on public.inventory_adjustments from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;

grant select on public.shopify_orders to authenticated;
grant update (
  delegate_order_id,
  postal_code,
  carrier,
  delegate_order_created_at,
  delivered_at,
  delivery_status,
  logistics_status,
  internal_notes,
  action_needed,
  updated_at
) on public.shopify_orders to authenticated;

grant select on public.inventory to authenticated;
grant insert, update, delete on public.inventory to authenticated;

grant select on public.inventory_adjustments to authenticated;
grant insert on public.inventory_adjustments to authenticated;
