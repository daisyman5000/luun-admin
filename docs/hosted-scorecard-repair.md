# Hosted scorecard integration — local approval candidate, October29,2026

Base main3561d875b7f932864a1779e4f1fb323f2703cb07, isolated branch
fix/hosted-scorecard-review. No push, deployment, production job/configuration,
schema/data write, credential read/change or tunnel restart performed. Pending
campaign/fee/customs work and the installed Mac model remain untouched.

## Existing hosted data, no new table

Production was read-only verified to contain finance_plan_snapshots,
finance_actual_records and finance_actual_runs with owner/admin SELECT policies.
Reuse them. Actual records and saved plans are insert-only. Keep legacy mutable
coverage heads so old consumers retain their expected behavior; additionally
append deterministic history:v1 coverage revisions using INSERT ON CONFLICT DO
NOTHING. Preserve original observed_at, covered dates, timezone and transaction
instants when present. Existing readers exclude archive rows; new cutoff reads
choose the latest eligible immutable coverage per category, not any old success.

The existing daily08:00UTC source-sync path refreshes core Wise/Shopify state.
The patch fixes claim/read/finalize isolation and HTTP health. After successful
core polling it also reuses existing bounded Shopify capture/refund ingestion and
reviewed-expense evidence ingestion for the previous Vancouver day, preserving
legacy record-day semantics. These actions write only existing financial evidence,
coverage heads and append-only coverage revisions; they do not mark bills paid,
change payment/order/business records or fetch advertising provider data. All
provider ingestion remains uninvoked locally; production activation requires
explicit review. Optional observation failures remain separate from core source
freshness. Incomplete recent-order access is never promoted to complete coverage.

## Timezones and original targets

Historical hosted plan bf90834b-8ae1-458d-87f5-c7860cc54e9a was owner-saved
2026-10-23T20:46:14.648035Z, source2026-10-23T20:45:48.704Z, America/Vancouver.
Fingerprint82083e2d308b077d7b166fc8ece6cc7e5e46211ab6f3d9613bfb7a5e70717f39
was recomputed; all366 daily equations reconcile. It is not the installed private
October24 plan: October28 closing cash differs by CAD0.04. Preserve its label.
Date-only Vancouver aggregates cannot be redistributed into Cancun days.

New morning reports use America/Cancun. Only transaction records with an original
UTC processing instant retained in immutable coverage metadata can be assigned to
a Cancun day; others remain labelled Vancouver evidence. Adjacent Vancouver days
are queried for this conversion. Captures/refunds are not bank-settled payouts.
No daily advertising feed is accessed; verified delivery stays unavailable unless
provided. No incomplete/foreign-currency/timezone-mismatched evidence produces a
complete-day variance. Legacy Vancouver UI does not automatically adopt a new
Cancun baseline, and explicit mismatched comparisons withhold variance.

The prospective Cancun baseline preview is
../evidence/hosted-scorecard-cancun-20261030-preview.json. It uses only the installed
Mac model/settings, no pending campaign or cost changes. It declares FUTURE
model day labels as Cancun dates from2026-10-30, not a conversion of historical
Vancouver results. Opening CAD82636.94 is projected October29 close, not new cash.
Original source export2026-10-29T15:39:25.601Z and Wise retrieval
2026-10-28T08:37:32.549Z are retained. Fingerprint(version2 including timezone):
c005d3dddc1bd11f6958a3da5e1c23f2f862088f34bc0c0b5d2dd83aaf5274b9.
Owner must approve and freeze before2026-10-30T05:00:00Z (Cancun midnight).
If missed, do not backdate; prepare and approve a new future-day baseline.
validateBaselinePublication enforces dates, source times, fingerprint and daily
arithmetic. The separately reviewed freeze SQL template is not executed by this
patch or report. Use the explicitly approved owner/admin actor; database created_at
is real insertion time. Inspect by fingerprint after any uncertain insert.

## Mac-independent morning automation

Use the existing Supabase connector, projectpgoxvqziybtasivqiymw. Execute only the
read-only docs/hosted-scorecard-read.sql and use docs/morning-scorecard-prompt.txt.
No Mac call, new credential, browser session copy or owner-session API access is
required. The owner-only GET /api/operator/scorecard?date=YYYY-MM-DD is a separate
human interface using existing RLS, not a connector endpoint. It reads hosted
source state and cutoff/date-matched history; it performs no provider requests.

Source polling attempts and full-day coverage are distinct. Newer Shopify or
fulfillment records do not prove operator_source_state was polled. Supabase pg_cron
and pg_net are not needed for the existing Vercel job. Exact cause of the missed
October29 poll is not established. Existing source states are latest context, not
immutable historical bank/inventory snapshots. Days before preserved records,
original UTC instants or immutable coverage cannot be reconstructed from today's
order status or a regenerated future plan.

## Production approval package / rollback

1. Review the isolated diff against main3561d87; no pending campaign/fee files or
schema changes. Approve publication/deployment only for this integration.
2. Separately approve the existing daily worker's bounded source calls and finance
observation writes described above, and switching the existing morning automation
to direct read-only Supabase data. Do not claim these operations occurred here.
3. Separately approve the exact prospective Cancun packet/fingerprint and one
insert into existing finance_plan_snapshots before the deadline, no overwrite.
Original targets remain fixed; future approved revisions append new snapshots.
4. Verify current cron registration/enabled state and existing credential presence
through authorized metadata. Do not read secrets or retry denied scope through
another tool. Source-job invocation requires parent review, then verify stored
attempt/success/coverage dates, not only HTTP response. No new credential/service.
5. Rollback code with a scoped revert. Keep append-only actual/coverage evidence
and original plans; old readers ignore history:v1 archive rows. Do not delete
financial evidence to undo an application release.

Exact retained denials: evidence/source-sync-release.json records CREATE production
sensitive CRON_SECRET for projectprj_HFSBQu75qPPYvOokMHxl2EuvGEWB,
teamteam_7gWEJaTq2aHrlfnqyRaEeUHI, denied403 scope authorization, no secret created.
evidence/instagram-external-approval-scope.json.blockedConfigurationAccess records
Production environment metadata/settings for the SAME project/team denied by
service403 scope authorization. It does not retain an exact HTTP method/path, so
none is invented here. Neither operation was retried or bypassed.

## Activation correction — observation-only revision

The reporting source worker no longer imports or upserts shopify_orders. It queries
previous Cancun-day orders read-only and appends immutable orders:v1 observations
to existing finance_actual_runs (category collections, complete=false; package kind
and scanComplete distinguish order evidence from collection coverage). It updates
only its own operator_source_state scope shopify_orders/scorecard_daily. Legacy
incremental cache state is untouched. Legacy actual readers exclude orders:v1.
Existing order import/webhook workflows and schedules are not changed or invoked.
No reservation or inventory trigger is reached by this reporting worker. Paid
expense and Shopify capture/refund observations remain partial finance evidence.
Morning SQL additionally reads bounded synced order cache records without PII;
order/sales count and shop/presentment currency totals are distinct from captures.
The earlier evidence-only description of the full importer was incorrect: do not
invoke that broader importer as part of this rollout.

Approved Cancun baseline was inserted once at 2026-10-29T16:48:22.813872Z,
id 62cd49c8-8101-4c15-90fb-a86b2edfecd1; exact package readback matched. Existing
owner profile/old baseline creator 913c334c-7c7c-4aed-9ffa-7c8d225a95b0 was used as
created_by. Owner role was verified, but connector authenticated identity was not
verified as this UUID; retain this attribution limitation rather than inventing it.
