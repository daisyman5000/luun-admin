# Luun funnel and first improvement loop

Owner/admin workspace: `/funnel`. Existing Supabase service credentials only. No advertising connector, Meta requests, new OAuth scopes or renewing AI budget. The existing OpenAI runtime credential is used for separately authorized reviews.

## Collection

Webflow loads `/luun-funnel-v1.js`. First-party write-only collector accepts four stages: landing, product_view (visible collection card/builder), configuration (interaction with the existing builder), checkout_start (successful Luun checkout response). A configuration is not claimed to be a cart addition. Anonymous UUID in tab sessionStorage, 30-minute inactivity expiry on navigation. No PII, query URLs, referrers, IPs or raw campaign tags stored. Channel is a coarse category only. DNT, GPC and `window.luunAnalyticsConsent === false` stop tracking. Collector rejects unapproved origins, >1200-byte bodies, invalid sessions, browser purchase events and excess requests. Origin checks and rate limits do not make browser telemetry tamper-proof. No individual event reads are exposed publicly.

An anonymous session attribute is added to the existing sale, regular preorder and fast checkout carts. Signed Shopify orders/create and orders/updated webhooks record paid/partially_paid, non-test, non-cancelled orders. Order ID deduplicates deliveries. Full initial booked order value is distinct from cash collected, refunds and profit. No historical visits are fabricated. Existing paid orders without browser/session attribution remain separate. Checkout paths outside instrumented Luun checkout and cross-device visits are unlinked.

## Analysis and drafts

Counts are unique, sequential, same-session stages, grouped by landing day in America/Vancouver. Test traffic (`?luun_test=1`) is excluded. Sessions at least 24 hours old qualify for bottleneck analysis. At least 100 entrants at a step are required. Ranking uses the largest absolute lost-session count, not statistical significance, causality or expected revenue. A higher stage cannot be inferred from a missing previous stage. Missing measurements do not establish zero business activity.

The metrics and bottleneck ranking are deterministic. The owner-authorized AI engine produces one critique, one short copy draft and one measurement suggestion, using aggregate evidence and the previous AI draft. Insufficient data must be explicitly stated; a draft is a hypothesis, not a proven fix. Workspace refreshes and saves analysis every minute while visible; each report uses the current evidence. Automatic cycles and Save review & draft preserve fingerprinted, immutable learning snapshots. Repeating an unchanged save deduplicates. There is no autonomous publishing or campaign access. The old script budgets are not reused. AI reviews run through the owner workspace cycle while open, not a new scheduled background job.

## Validation

`node --test tests/funnel.test.cjs tests/funnel-routes.test.cjs`, `npm run test:checkout`, targeted ESLint and `npm run build`.

Production collector smoke tests must use `test:true`, and verify those rows do not enter metrics. Never place a real order just to test tracking. Test signed purchase delivery through fixtures. Do not render the live storefront during agent tests because it includes existing third-party advertising pixels. Read HTML without executing it and test the new script in an isolated VM fixture instead.

## AI allowance authorized October 23, 2026

One-time USD 1 total, USD .05 per review, no renewal. A dedicated database allowance atomically reserves 50,000 microUSD before each review. At most 20 reservations; none are refunded or automatically retried. SQL locks serialize concurrent claims and evidence fingerprints deduplicate requests. Only the authorizing owner may dispatch; other roles can read existing results through the normal owner/admin API gate. Pending/uncertain calls block further dispatch. After one baseline review, 25 additional mature sessions or 5 additional linked paid sessions are required. Changing dashboard dates cannot trigger new spending; the AI always uses the latest 31-day window.

Existing pinned model: gpt-5.4-mini-2026-03-17, store:false, no tools, reasoning:none, max 2,000 output tokens. Exact input-token preflight refuses above 6,000. Verified standard rates October 23: USD .75/M input, USD 4.50/M output; maximum generation envelope USD .0135, below the .05 reservation. Cached input discounted when returned in usage. Rates: https://developers.openai.com/api/docs/models/gpt-5.4-mini . Price verification expires after seven days, pausing calls until rechecked without resetting the allowance. Actual token costs and provider response IDs are stored separately from conservative reservations. No raw visitor identifiers or customer records are sent.

`LUUN_FUNNEL_AI_DISABLED=1` is a server-side stop switch. Missing existing credentials fail closed; code never installs or changes a credential or permission. Invalid/interrupted provider results retain their reservation and bounded output for reconciliation, with no provider retry.

Tests: `node --test tests/funnel-ai.test.cjs tests/funnel.test.cjs tests/funnel-routes.test.cjs`. Database cap test reserves 20 synthetic reviews in a rolled-back transaction and verifies the 21st is refused; no paid calls or fake business records persist.
