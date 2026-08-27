create table if not exists public.container_entries (
  id uuid primary key default gen_random_uuid(),
  container_number text not null,
  purchase_order_id text,
  skus_on_board text,
  manifest_json jsonb default '[]'::jsonb,
  amount_paid numeric default 0,
  amount_to_be_paid numeric default 0,
  payment_due_at date,
  eta date,
  status text default 'planning' check (status in ('planning', 'production', 'in_transit', 'arrived', 'closed')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists container_entries_eta_idx on public.container_entries (eta);
create index if not exists container_entries_status_idx on public.container_entries (status);
create unique index if not exists container_entries_container_number_idx
on public.container_entries (container_number);

drop trigger if exists set_container_entries_updated_at on public.container_entries;
create trigger set_container_entries_updated_at
before update on public.container_entries
for each row execute function public.set_updated_at();

create or replace function public.set_container_entries_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_container_entries_updated_by on public.container_entries;
create trigger set_container_entries_updated_by
before update on public.container_entries
for each row execute function public.set_container_entries_updated_by();

alter table public.container_entries enable row level security;

drop policy if exists "Authenticated users can read container entries" on public.container_entries;
create policy "Authenticated users can read container entries"
on public.container_entries for select
to authenticated
using (true);

drop policy if exists "Logistics roles can insert container entries" on public.container_entries;
create policy "Logistics roles can insert container entries"
on public.container_entries for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

drop policy if exists "Logistics roles can update container entries" on public.container_entries;
create policy "Logistics roles can update container entries"
on public.container_entries for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Owner and admin can delete container entries" on public.container_entries;
create policy "Owner and admin can delete container entries"
on public.container_entries for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin']));

revoke all on public.container_entries from anon, authenticated;
grant select, insert, update, delete on public.container_entries to authenticated;
