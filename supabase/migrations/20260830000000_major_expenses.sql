create table if not exists public.major_expenses (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric default 0,
  currency text default 'CAD',
  due_date date,
  status text default 'open' check (status in ('open', 'paid', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists major_expenses_due_date_idx on public.major_expenses (due_date);
create index if not exists major_expenses_status_idx on public.major_expenses (status);

drop trigger if exists set_major_expenses_updated_at on public.major_expenses;
create trigger set_major_expenses_updated_at
before update on public.major_expenses
for each row execute function public.set_updated_at();

create or replace function public.set_major_expenses_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_major_expenses_updated_by on public.major_expenses;
create trigger set_major_expenses_updated_by
before update on public.major_expenses
for each row execute function public.set_major_expenses_updated_by();

alter table public.major_expenses enable row level security;

drop policy if exists "Authenticated users can read major expenses" on public.major_expenses;
create policy "Authenticated users can read major expenses"
on public.major_expenses for select
to authenticated
using (true);

drop policy if exists "Logistics roles can insert major expenses" on public.major_expenses;
create policy "Logistics roles can insert major expenses"
on public.major_expenses for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and created_by = auth.uid()
);

drop policy if exists "Logistics roles can update major expenses" on public.major_expenses;
create policy "Logistics roles can update major expenses"
on public.major_expenses for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (public.current_user_has_role(array['owner', 'admin', 'logistics']));

drop policy if exists "Logistics roles can delete major expenses" on public.major_expenses;
create policy "Logistics roles can delete major expenses"
on public.major_expenses for delete
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']));

revoke all on public.major_expenses from anon, authenticated;
grant select, insert, update, delete on public.major_expenses to authenticated;
