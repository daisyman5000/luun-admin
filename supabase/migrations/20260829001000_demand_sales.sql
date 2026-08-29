create table if not exists public.demand_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists demand_sales_sale_date_idx on public.demand_sales (sale_date);

alter table public.demand_sales enable row level security;

drop policy if exists "Authenticated users can read demand sales" on public.demand_sales;
create policy "Authenticated users can read demand sales"
on public.demand_sales for select
to authenticated
using (true);

drop policy if exists "Logistics roles can create demand sales" on public.demand_sales;
create policy "Logistics roles can create demand sales"
on public.demand_sales for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

drop policy if exists "Logistics roles can delete demand sales" on public.demand_sales;
create policy "Logistics roles can delete demand sales"
on public.demand_sales for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']));

revoke all on public.demand_sales from anon, authenticated;
grant select, insert, delete on public.demand_sales to authenticated;
