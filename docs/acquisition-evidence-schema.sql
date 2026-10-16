-- REVIEW DRAFT ONLY. Not applied, not an automatically replayable migration.
-- If approved, generate a migration with Supabase CLI and apply in the confirmed project.
create table public.acquisition_period_evidence (
 month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 currency text not null check(currency in ('CAD','USD')),
 package jsonb not null check(jsonb_typeof(package)='object'),
 updated_at timestamptz not null default now(),
 primary key(month,currency)
);
alter table public.acquisition_period_evidence enable row level security;
revoke all on public.acquisition_period_evidence from public,anon,authenticated;
grant select on public.acquisition_period_evidence to authenticated;
create policy financial_owners_read_acquisition_evidence on public.acquisition_period_evidence for select to authenticated using (
 exists(select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role in ('owner','admin'))
);
-- No app write grant or ingestion worker added by this draft. Reconciled evidence
-- requires separately approved ingestion and provenance, not client-supplied amounts.
