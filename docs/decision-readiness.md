# Position and historical advertising reconciliation

The Demand & Sales view shows available Wise cash, known commitments, draft ads and a provisional remainder in separate columns by currency. It includes owner-designated personal funds for planning but retains legal-account grouping. It never transfers money or invents FX. The remainder is not profit or safe-to-spend cash.

Ranked reviews cover recorded shortfalls, unreconciled obligations, fulfilment risk and advertising evidence. The supporting timeline connects recorded payment dates, inbound ETAs and saved sale dates. Unknown dates remain undated; ETA is distinct from warehouse receipt and customer delivery. The downside control models an explicitly entered extra outflow without future sales receipts.

## Financial-ad data contract

- `POST /api/acquisition?month=YYYY-MM` requires the existing signed-in owner/admin role and same origin. It reads only a bounded Wise statement interval (selected month plus3 days before/7 after for settlement lag), through the existing server credential. No Meta, Instagram, new connection or token is used. Raw account-holder/bank-detail payloads are discarded; only advertising/PayPal matching candidates reach the authorized owner UI.
- `LUUN_WISE_AD_SPEND_ENABLED=1` enables only this reconciliation path. General statement reports remain disabled (`LUUN_WISE_STATEMENTS_ENABLED=0`). Requests are coalesced/cached5 minutes per month per server runtime. This is not a distributed account-wide limiter.
- `GET /api/acquisition` reads saved evidence and stored Shopify orders without reading Wise statements. Missing evidence storage is reported as incomplete and does not block an explicit Wise read. Default selection is the latest covered positive-ad-spend month available, otherwise July for review only.
- Receipt identity is canonical receipt/invoice ID, not email ID. Exact settlement IDs link a receipt and debit as one cost. No amount-only/fuzzy PayPal matching. Credits reduce spend. Cross-currency matches require explicit verified FX support, which is not implemented; they are withheld. Costs use gross charges including tax, with no tax-recoverability assumption.
- A receipt needs a verified service month and matched funding evidence. Settlement month alone does not establish the ad service month. A receipt across months needs a documented allocation before use.
- Metric = complete matched monthly ad cost / eligible unique new customers only when first-paid-order customer history is verified. Otherwise label `Ad cost per paid order`; fully refunded, cancelled, test and unpaid orders are excluded, partially refunded orders retain one acquisition. Missing import/refund/receipt/funding coverage withholds the full monthly metric. No campaign attribution or incremental/marginal causal CAC is claimed.
- Shopify reads are paginated with a10,000-row safety cap; stored-row read time/latest update are shown separately from unknown upstream sync freshness. The existing importer does not provide authoritative first-paid-order history, so the current supported denominator is orders.

## Required data work, not performed by this release

`supabase/migrations/20261016211041_operator_source_sync.sql` is the approved applied three-table evidence/sync migration. See `docs/source-sync-activation.md` for the protected worker, ingestion contract and activation status. After specific approval, durable private evidence storage must retain receipt/invoice identity, currency/gross charge and credits, service period, settlement references/status, source evidence date and review timestamp, plus explicit coverage attestations for receipts, funding sources, order import and adjustments. No client can submit amounts or mark coverage complete through the new read route.

Existing bills/container records must be checked before importing evidence to avoid duplicates. Preserve paid deposits versus outstanding balance. A payment already settled before the cash snapshot must not be subtracted again. Open/overdue records are provisional, not proof they remain unpaid. Source documents with missing due dates remain undated; draft taxes remain provisional. The pure calculation supports confirmed-paid exclusions; existing rows still need authorized reconciliation before that status can be trusted.

## Update boundaries

Active Demand page refreshes position about every60 seconds while visible. The historical-cost section re-reads selected-month data about every5 minutes while visible. Hidden pages pause requests; retrieval timestamps and error/stale states remain explicit. This is browser-driven refresh, not background synchronization. Shopify upstream freshness depends on existing authorized webhook/import configuration. Continuous Gmail ingestion is not configured. A backend scheduler needs separately approved durable storage, scoped authentication and cadence; this release does not add those security changes.

## Verification limits

Tests use synthetic transactions, orders, cash and obligations. They establish arithmetic, matching and UI behavior, not real-month completeness, accounting certification or decision profitability. Actual monthly Wise statements are checked only after publication through the existing authenticated browser session, never by copying credentials locally. No paid model call is part of verification.
