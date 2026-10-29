-- APPROVAL TEMPLATE ONLY. Never executed by morning automation or this task.
-- Parent must validate the reviewed packet/fingerprint in application code first.
-- Bind $1 title, $2 reviewed fingerprint, $3 first day, $4 last day,
-- $5 explicitly approved owner/admin actor UUID, $6 exact reviewed package JSON.
-- No created_at override: the database records the actual insertion time.
insert into public.finance_plan_snapshots(title,fingerprint,from_day,through_day,created_by,package)
select $1,$2,$3::date,$4::date,$5::uuid,$6::jsonb
where statement_timestamp()<($3::date::timestamp at time zone 'America/Cancun')
 and $6::jsonb->>'timeZone'='America/Cancun'
 and $6::jsonb->>'fingerprintVersion'='2'
 and $6::jsonb->'days'->0->>'day'=$3::date::text
 and exists(select 1 from public.profiles where id=$5::uuid and role in('owner','admin'))
on conflict(fingerprint) do nothing returning id,created_at,fingerprint;
-- If outcome is uncertain, SELECT by reviewed fingerprint before any further action.
-- A zero-row result is not a successful new freeze. Do not backdate or overwrite.
