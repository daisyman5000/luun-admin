create table if not exists public.demand_month_settings (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^\d{4}-\d{2}$'),
  max_daily_ad_spend integer not null default 400 check (max_daily_ad_spend >= 0 and max_daily_ad_spend <= 5000),
  max_days_apart integer not null default 3 check (max_days_apart >= 1 and max_days_apart <= 14),
  sale_duration_days integer not null default 10 check (sale_duration_days >= 1 and sale_duration_days <= 21),
  sale_start_day integer not null default 1 check (sale_start_day >= 1 and sale_start_day <= 31),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists demand_month_settings_month_idx on public.demand_month_settings (month);

drop trigger if exists set_demand_month_settings_updated_at on public.demand_month_settings;
create trigger set_demand_month_settings_updated_at
before update on public.demand_month_settings
for each row execute function public.set_updated_at();

alter table public.demand_month_settings enable row level security;

drop policy if exists "Authenticated users can read demand month settings" on public.demand_month_settings;
create policy "Authenticated users can read demand month settings"
on public.demand_month_settings for select
to authenticated
using (true);

drop policy if exists "Logistics roles can create demand month settings" on public.demand_month_settings;
create policy "Logistics roles can create demand month settings"
on public.demand_month_settings for insert
to authenticated
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and updated_by = auth.uid()
);

drop policy if exists "Logistics roles can update demand month settings" on public.demand_month_settings;
create policy "Logistics roles can update demand month settings"
on public.demand_month_settings for update
to authenticated
using (public.current_user_has_role(array['owner', 'admin', 'logistics']))
with check (
  public.current_user_has_role(array['owner', 'admin', 'logistics'])
  and updated_by = auth.uid()
);

revoke all on public.demand_month_settings from anon, authenticated;
grant select, insert, update on public.demand_month_settings to authenticated;
