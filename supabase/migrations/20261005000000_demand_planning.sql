create table if not exists public.demand_planning_settings (
 id integer primary key check (id = 1),
 settings jsonb not null,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.demand_planning_settings enable row level security;
create policy "Financial roles read planning" on public.demand_planning_settings for select to authenticated using(public.current_user_has_role(array['owner','admin']));
create policy "Financial roles insert planning" on public.demand_planning_settings for insert to authenticated with check(public.current_user_has_role(array['owner','admin']) and updated_by=auth.uid());
create policy "Financial roles update planning" on public.demand_planning_settings for update to authenticated using(public.current_user_has_role(array['owner','admin'])) with check(public.current_user_has_role(array['owner','admin']) and updated_by=auth.uid());
grant select,insert,update on public.demand_planning_settings to authenticated;
