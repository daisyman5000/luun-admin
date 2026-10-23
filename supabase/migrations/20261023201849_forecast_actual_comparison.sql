create table public.finance_actual_records (
 id text primary key check(length(id) between 1 and 300),
 day date not null, category text not null check(category in('collections','ad_spend','ad_payment','expenses')),
 amount numeric(16,2) not null, currency text not null check(currency ~ '^[A-Z]{3}$'),
 provider text not null check(provider in('shopify','wise','report','confirmed-record')),
 description text not null check(length(description)<=500), source_ref text not null check(length(source_ref)<=1000),
 basis text not null check(length(basis)<=500), fingerprint text not null,
 recorded_at timestamptz not null default now()
);
create index finance_actual_records_day on public.finance_actual_records(day,category);
create table public.finance_actual_runs (
 id text primary key, category text not null check(category in('collections','ad_spend','ad_payment','expenses')),
 from_day date not null, through_day date not null check(through_day>=from_day),
 complete boolean not null default false, observed_at timestamptz not null default now(),
 package jsonb not null check(jsonb_typeof(package)='object' and octet_length(package::text)<=100000)
);
create table public.finance_plan_snapshots (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
 fingerprint text not null unique, from_day date not null, through_day date not null check(through_day>=from_day),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 package jsonb not null check(jsonb_typeof(package)='object' and octet_length(package::text)<=250000)
);
alter table public.finance_actual_records enable row level security;
alter table public.finance_actual_runs enable row level security;
alter table public.finance_plan_snapshots enable row level security;
revoke all on public.finance_actual_records,public.finance_actual_runs,public.finance_plan_snapshots from public,anon,authenticated;
grant select on public.finance_actual_records,public.finance_actual_runs,public.finance_plan_snapshots to authenticated;
grant select,insert on public.finance_actual_records,public.finance_plan_snapshots to service_role;
grant select,insert,update on public.finance_actual_runs to service_role;
create policy finance_owner_read on public.finance_actual_records for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('owner','admin')));
create policy finance_owner_read on public.finance_actual_runs for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('owner','admin')));
create policy finance_owner_read on public.finance_plan_snapshots for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('owner','admin')));
