-- APPROVAL DRAFT ONLY. No execution or automatic migration replay.
-- Confirm target pgoxvqziybtasivqiymw and generate a tracked migration after approval.
create table public.operator_financial_evidence (
 evidence_key text not null, revision_hash text not null,
 canonical_key text not null, provider text not null check(provider in ('gmail','wise','shopify')),
 kind text not null check(kind in ('ad_receipt','payable','settlement','credit')),
 source_ref text not null, evidence_at timestamptz,
 service_from date, service_to date, amount numeric check(amount>=0), currency text check(currency ~ '^[A-Z]{3}$'),
 settlement_state text not null default 'unverified' check(settlement_state in ('unverified','verified_unpaid','confirmed_paid')),
 review_state text not null default 'unreviewed' check(review_state in ('unreviewed','reviewed','conflict')),
 package jsonb not null check(jsonb_typeof(package)='object'),
 ingested_at timestamptz not null default now(), primary key(evidence_key,revision_hash)
);
create index operator_evidence_canonical on public.operator_financial_evidence(canonical_key);
create table public.acquisition_period_evidence (
 month text not null check(month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 currency text not null check(currency in ('CAD','USD')),
 package jsonb not null check(jsonb_typeof(package)='object'),
 updated_at timestamptz not null default now(),primary key(month,currency)
);
create table public.operator_source_state (
 source text not null check(source in ('wise_balances','wise_ads','shopify_orders','gmail_evidence')),
 scope text not null, status text not null default 'unconfigured' check(status in ('unconfigured','running','ok','partial','error','blocked')),
 last_attempt_at timestamptz,last_success_at timestamptz,source_updated_at timestamptz,
 coverage_from timestamptz,coverage_to timestamptz,read_complete boolean not null default false,
 cursor jsonb not null default '{}'::jsonb,payload jsonb,warnings jsonb not null default '[]'::jsonb,
 last_run_id uuid,last_run_finished_at timestamptz,last_run_count integer not null default 0,attempt_payload jsonb,
 lease_owner uuid,lease_until timestamptz,primary key(source,scope)
);
-- New financial data is owner/admin-only. Existing business table policies are unchanged.
alter table public.operator_financial_evidence enable row level security;
alter table public.acquisition_period_evidence enable row level security;
alter table public.operator_source_state enable row level security;
revoke all on public.operator_financial_evidence,public.acquisition_period_evidence,public.operator_source_state from public,anon,authenticated;
grant select on public.operator_financial_evidence,public.acquisition_period_evidence,public.operator_source_state to authenticated;
grant select,insert on public.operator_financial_evidence to service_role;
grant select,insert,update on public.acquisition_period_evidence,public.operator_source_state to service_role;
create policy owner_read_financial_evidence on public.operator_financial_evidence for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
create policy owner_read_acquisition_evidence on public.acquisition_period_evidence for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
create policy owner_read_source_state on public.operator_source_state for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('owner','admin')));
-- SECURITY INVOKER: privileged only through the existing server service role.
create function public.claim_operator_source_sync(p_source text,p_scope text,p_owner uuid)
returns boolean language sql security invoker set search_path='' as $$
 with claimed as (
 insert into public.operator_source_state(source,scope,status,last_attempt_at,lease_owner,lease_until)
 values(p_source,p_scope,'running',now(),p_owner,now()+interval '5 minutes')
 on conflict(source,scope) do update set status='running',last_attempt_at=now(),lease_owner=p_owner,lease_until=now()+interval '5 minutes'
 where operator_source_state.lease_until is null or operator_source_state.lease_until<now()
 returning 1) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_operator_source_sync(text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_operator_source_sync(text,text,uuid) to service_role;
