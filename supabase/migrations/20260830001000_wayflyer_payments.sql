create table if not exists public.wayflyer_payments (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric default 0,
  due_date date,
  status text default 'scheduled' check (status in ('scheduled', 'paid', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists wayflyer_payments_due_date_idx on public.wayflyer_payments (due_date);
create index if not exists wayflyer_payments_status_idx on public.wayflyer_payments (status);

drop trigger if exists set_wayflyer_payments_updated_at on public.wayflyer_payments;
create trigger set_wayflyer_payments_updated_at
before update on public.wayflyer_payments
for each row execute function public.set_updated_at();

create or replace function public.set_wayflyer_payments_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_wayflyer_payments_updated_by on public.wayflyer_payments;
create trigger set_wayflyer_payments_updated_by
before update on public.wayflyer_payments
for each row execute function public.set_wayflyer_payments_updated_by();

alter table public.wayflyer_payments enable row level security;

drop policy if exists "Authenticated users can read Wayflyer payments" on public.wayflyer_payments;
create policy "Authenticated users can read Wayflyer payments"
on public.wayflyer_payments for select
to authenticated
using (true);

drop policy if exists "Logistics roles can insert Wayflyer payments" on public.wayflyer_payments;
create policy "Logistics roles can insert Wayflyer payments"
on public.wayflyer_payments for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

drop policy if exists "Logistics roles can update Wayflyer payments" on public.wayflyer_payments;
create policy "Logistics roles can update Wayflyer payments"
on public.wayflyer_payments for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Logistics roles can delete Wayflyer payments" on public.wayflyer_payments;
create policy "Logistics roles can delete Wayflyer payments"
on public.wayflyer_payments for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']));

revoke all on public.wayflyer_payments from anon, authenticated;
grant select, insert, update, delete on public.wayflyer_payments to authenticated;
