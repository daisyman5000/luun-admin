-- One-time owner authorization, 2026-10-23: USD 1 total, USD .05/review, no renewal.
create table public.funnel_ai_allowance (
 id text primary key check(id='luun-funnel-ai-20261023'),owner_id uuid not null references auth.users(id),
 total_microusd integer not null check(total_microusd=1000000),per_review_microusd integer not null check(per_review_microusd=50000),
 reserved_microusd integer not null default 0 check(reserved_microusd between 0 and 1000000),created_at timestamptz not null default now()
);
create table public.funnel_ai_reviews (
 id uuid primary key default gen_random_uuid(),evidence_key text not null unique check(evidence_key ~ '^[0-9a-f]{64}$'),
 actor uuid not null references auth.users(id),status text not null check(status in ('pending','complete','failed','uncertain')),
 reserved_microusd integer not null check(reserved_microusd=50000),actual_microusd integer check(actual_microusd between 0 and 50000),
 package jsonb not null check(jsonb_typeof(package)='object' and octet_length(package::text)<60000),created_at timestamptz not null default now()
);
alter table public.funnel_ai_allowance enable row level security;
alter table public.funnel_ai_reviews enable row level security;
revoke all on public.funnel_ai_allowance,public.funnel_ai_reviews from public,anon,authenticated;
grant select,insert,update on public.funnel_ai_allowance,public.funnel_ai_reviews to service_role;
insert into public.funnel_ai_allowance(id,owner_id,total_microusd,per_review_microusd) values('luun-funnel-ai-20261023','913c334c-7c7c-4aed-9ffa-7c8d225a95b0',1000000,50000);
create function public.claim_funnel_ai_review(actor_input uuid,evidence_key_input text,package_input jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare allowance public.funnel_ai_allowance; previous public.funnel_ai_reviews; review public.funnel_ai_reviews;begin
 select * into allowance from public.funnel_ai_allowance where id='luun-funnel-ai-20261023' for update;
 if allowance.owner_id is distinct from actor_input then return jsonb_build_object('reason','Owner authorization required');end if;
 if exists(select 1 from public.funnel_ai_reviews where evidence_key=evidence_key_input) then return jsonb_build_object('reason','These results have already been reviewed or reserved');end if;
 if exists(select 1 from public.funnel_ai_reviews where status in ('pending','uncertain')) then return jsonb_build_object('reason','A pending or uncertain review needs reconciliation');end if;
 if allowance.reserved_microusd+50000>allowance.total_microusd then return jsonb_build_object('reason','One-time AI budget exhausted');end if;
 select * into previous from public.funnel_ai_reviews order by created_at desc,id desc limit 1;
 if found and coalesce((package_input->'evidence'->>'matureSessions')::integer,0)<coalesce((previous.package->'evidence'->>'matureSessions')::integer,0)+25 and coalesce((package_input->'evidence'->>'paidOrders')::integer,0)<coalesce((previous.package->'evidence'->>'paidOrders')::integer,0)+5 then return jsonb_build_object('reason','Waiting for 25 new mature visits or 5 new linked purchases');end if;
 insert into public.funnel_ai_reviews(evidence_key,actor,status,reserved_microusd,package) values(evidence_key_input,actor_input,'pending',50000,package_input) returning * into review;
 update public.funnel_ai_allowance set reserved_microusd=reserved_microusd+50000 where id=allowance.id;
 return jsonb_build_object('id',review.id);
end $$;
revoke all on function public.claim_funnel_ai_review(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_funnel_ai_review(uuid,text,jsonb) to service_role;
