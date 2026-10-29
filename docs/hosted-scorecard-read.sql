-- READ ONLY. Existing connected Supabase project pgoxvqziybtasivqiymw.
-- Run once per report; generated_at is a query cutoff, NEVER source freshness.
-- Approval of the future baseline insert is separate. If absent, no target is returned.
with input as (
 select ((statement_timestamp() at time zone 'America/Cancun')::date-1) as report_day,
 statement_timestamp() as cutoff,
 'America/Cancun'::text as report_zone,
 'bf90834b-8ae1-458d-87f5-c7860cc54e9a'::uuid as historical_plan,
 'c005d3dddc1bd11f6958a3da5e1c23f2f862088f34bc0c0b5d2dd83aaf5274b9'::text as prospective_fingerprint
), chosen_plan as (
 select s.* from public.finance_plan_snapshots s cross join input i
 where s.from_day<=i.report_day and s.through_day>=i.report_day
 and s.created_at < (i.report_day::timestamp at time zone i.report_zone)
 and s.created_at<=i.cutoff
 and ((i.report_day<'2026-10-30'::date and s.id=i.historical_plan)
 or (i.report_day>='2026-10-30'::date and s.fingerprint=i.prospective_fingerprint and s.package->>'timeZone'=i.report_zone and s.from_day='2026-10-30'::date and s.created_at<'2026-10-30T05:00:00Z'::timestamptz))
 order by s.created_at,s.id limit 1
), records as (
 select a.id,a.day,a.category,a.amount,a.currency,a.provider,a.source_ref,a.basis,a.recorded_at
 from public.finance_actual_records a cross join input i
 where a.day between i.report_day-1 and i.report_day+1 and a.recorded_at<=i.cutoff order by a.id limit 1001
), runs as (
 select r.* from public.finance_actual_runs r cross join input i
 where r.from_day<=i.report_day+1 and r.through_day>=i.report_day-1 and r.observed_at<=i.cutoff
 order by r.observed_at desc,r.id limit 1001
), daily_orders as (
 select o.shopify_order_id as id,o.created_at,o.updated_at,
 o.raw_shopify_json->'test' as test,o.raw_shopify_json->'cancelledAt' as cancelled_at,
 (o.raw_shopify_json ? 'cancelledAt') as cancellation_known,
 o.raw_shopify_json->'currentTotalPriceSet'->'shopMoney' as shop_money,
 o.raw_shopify_json->'currentTotalPriceSet'->'presentmentMoney' as presentment_money
 from public.shopify_orders o cross join input i
 where o.created_at >= (i.report_day::timestamp at time zone i.report_zone)
 and o.created_at < ((i.report_day+1)::timestamp at time zone i.report_zone)
 and o.updated_at<=i.cutoff
 order by o.shopify_order_id limit 1001
), sources as (
 select source,scope,status,last_attempt_at,last_success_at,source_updated_at,coverage_from,coverage_to,read_complete,last_run_count
 from public.operator_source_state order by source,scope limit 101
), bank as (
 select payload,last_success_at,status from public.operator_source_state
 where source='wise_balances' and scope='available' limit 1
)
select jsonb_build_object(
 'contract_version',2,'report_day',i.report_day,'report_time_zone',i.report_zone,'cutoff',i.cutoff,
 'original_plan',(select jsonb_build_object('id',s.id,'title',s.title,'fingerprint',s.fingerprint,'created_at',s.created_at,'source_at',s.package->>'sourceAt','time_zone',s.package->>'timeZone','target',(select d from jsonb_array_elements(s.package->'days') d where d->>'day'=i.report_day::text limit 1)) from chosen_plan s),
 'actual_records',coalesce((select jsonb_agg(to_jsonb(a)) from records a),'[]'::jsonb),
 'synced_daily_orders',coalesce((select jsonb_agg(to_jsonb(o)) from daily_orders o),'[]'::jsonb),
 'coverage_runs',coalesce((select jsonb_agg(to_jsonb(r)) from runs r),'[]'::jsonb),
 'actual_day_legacy_time_zone','America/Vancouver',
 'source_states',coalesce((select jsonb_agg(to_jsonb(s)) from sources s),'[]'::jsonb),
 'current_bank_context',(select jsonb_build_object('status',b.status,'last_success_at',b.last_success_at,'retrieved_at',b.payload->'sources'->'balances'->>'retrievedAt','balances',(select jsonb_agg(jsonb_build_object('amount',v->'amount','currency',v->>'currency','profile_type',v->>'profileType')) from jsonb_array_elements(case when jsonb_typeof(b.payload->'balances')='array' then b.payload->'balances' else '[]'::jsonb end) v where v->>'currency'='CAD' and lower(v->>'profileType') in('business','personal'))) from bank b),
 'limits_exceeded',jsonb_build_object('actual_records',(select count(*)>1000 from records),'coverage_runs',(select count(*)>1000 from runs),'source_states',(select count(*)>100 from sources),'synced_daily_orders',(select count(*)>1000 from daily_orders)),
 'settled_bank_collections',null,'daily_ad_delivery',null,
 'notes',jsonb_build_array('Current source-state/bank rows are current context, not immutable prior-day observations.','Vancouver historical day aggregates are not Cancun day aggregates; withhold incompatible variance.','No record, complete-day zero, bank settlement or ad delivery is invented.')
) as scorecard_input from input i;
