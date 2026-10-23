# Luun funnel and first improvement loop

Owner/admin workspace: `/funnel`. Existing Supabase service credentials only. No advertising connector, Meta requests, AI provider calls, new OAuth scopes or recurring AI budget.

## Collection

Webflow loads `/luun-funnel-v1.js`. First-party write-only collector accepts four stages: landing, product_view (visible collection card/builder), configuration (interaction with the existing builder), checkout_start (successful Luun checkout response). A configuration is not claimed to be a cart addition. Anonymous UUID in tab sessionStorage, 30-minute inactivity expiry on navigation. No PII, query URLs, referrers, IPs or raw campaign tags stored. Channel is a coarse category only. DNT, GPC and `window.luunAnalyticsConsent === false` stop tracking. Collector rejects unapproved origins, >1200-byte bodies, invalid sessions, browser purchase events and excess requests. Origin checks and rate limits do not make browser telemetry tamper-proof. No individual event reads are exposed publicly.

An anonymous session attribute is added to the existing sale, regular preorder and fast checkout carts. Signed Shopify orders/create and orders/updated webhooks record paid/partially_paid, non-test, non-cancelled orders. Order ID deduplicates deliveries. Full initial booked order value is distinct from cash collected, refunds and profit. No historical visits are fabricated. Existing paid orders without browser/session attribution remain separate. Checkout paths outside instrumented Luun checkout and cross-device visits are unlinked.

## Analysis and drafts

Counts are unique, sequential, same-session stages, grouped by landing day in America/Vancouver. Test traffic (`?luun_test=1`) is excluded. Sessions at least 24 hours old qualify for bottleneck analysis. At least 100 entrants at a step are required. Ranking uses the largest absolute lost-session count, not statistical significance, causality or expected revenue. A higher stage cannot be inferred from a missing previous stage. Missing measurements do not establish zero business activity.

The draft engine is deterministic evidence rules, not an LLM. It provides one hypothesis, conservative copy and a measurement plan. Insufficient data yields an instrumentation task, not invented copy or a fake bottleneck. Workspace refreshes and saves analysis every minute while visible; each report uses the current evidence. Automatic cycles and Save review & draft preserve fingerprinted, immutable learning snapshots. Repeating an unchanged save deduplicates. There is no unattended paid optimizer or autonomous publishing. Paid AI and experiment spend require a separate bounded authorization; the old script budgets are not reused.

## Validation

`node --test tests/funnel.test.cjs tests/funnel-routes.test.cjs`, `npm run test:checkout`, targeted ESLint and `npm run build`.

Production collector smoke tests must use `test:true`, and verify those rows do not enter metrics. Never place a real order just to test tracking. Test signed purchase delivery through fixtures. Do not render the live storefront during agent tests because it includes existing third-party advertising pixels. Read HTML without executing it and test the new script in an isolated VM fixture instead.
