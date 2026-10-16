# Operator workspace — current local implementation

Isolated app: `/Users/tysonwalker/Documents/Codex/2026-10-16/task/luun-admin`. Original admin checkout and Creative Lab source/media are preserved. The hosted app has not been deployed or modified.

## Run and verify

The current local server is `http://127.0.0.1:4326`. Start only if it is not already listening:

```sh
NEXT_TELEMETRY_DISABLED=1 npm run dev -- --hostname 127.0.0.1 --port 4326
npm run typecheck -- --incremental false
npm run test:operator
LUUN_TEST_PGLITE_MODULE=/tmp/luun-sql-tests/node_modules/@electric-sql/pglite/dist/index.js npm run test:operator-sql
NEXT_TELEMETRY_DISABLED=1 LUUN_VERIFY_BUILD=1 npm run build -- --no-lint
```

Dependencies currently reuse the original admin's node_modules read-only through a symlink. Do not run npm install through that symlink. The Studio icon dependency is declared in package.json and an existing local copy is used as a webpack fallback in `.workspace-dependencies`; normal standalone installs resolve the declared package. The original project had no lockfile. Verification builds use `.next-verification` to avoid disrupting the running development server.

Sign in with an existing account at `/login`; no password belongs in chat. Configuration uses the confirmed Supabase project and a public publishable key, no service-role key. Browser authentication remains unverified. Anonymous readiness requests fail closed with 401.

## Content

Exactly three primary tabs: Content, Demand & Sales, Customers. Content has Calendar and Image Studio subviews. Calendar shows six real weeks, month navigation, saved due dates and planned instants in the device timezone. Select a day to create a dated package; select a post to edit it. The agenda remains below for review.

Database packages use the approved operator-workspace tables and authenticated RPCs. Draft → Needs review → Approved → Planned; changed editorial content/shared plan requires renewed review. Publication is a manual evidence record requiring a valid Instagram post/Reel URL; it does not publish. Database approval rejects local-only media references. Instagram integration is deferred.

The shared plan supports objective, target date, measurable cash reserve or new paid-order goal, manual daily CAD ad plan, promise, constraints and dated commitments. The goal/ad-plan fields are optional JSON fields in the existing approved contract; no additional schema migration was added. Saving an ad plan does not change an ad account.

## Existing image Studio

The existing Creative Lab image frontend is reused inside Content. Video, animation and credential settings are absent from the combined interface. Existing files, original app and generation engine are preserved. The authenticated bridge permits image state/media, reference uploads/selection, image generation/refinement, keep/reject and stop operations; no settings, credentials, video, animation or DELETE routes. Admin cookies and authorization headers are never forwarded. Tests use a mocked upstream and make no paid calls.

The authorized bridge is configured in the isolated local environment: `LUUN_STUDIO_ORIGIN=http://127.0.0.1:51406`. Existing PID 91504 listens there. Read-only bridge identity verification returned 200; anonymous admin Studio requests return 401. No credentials were copied or configured. Do not guess a port or start a second writer against the same library. The bridge is development/loopback only and fails closed on public/production hosts. Existing provider credentials stay in Creative Lab. Deliberately generating images can incur existing provider charges; no generation was tested.

## Demand & Sales

The main view reads current balances when Wise is configured, dated open invoices/financing/container commitments, unreserved stock, arrivals and existing paid-order/model inputs. It compares these with the saved outcome and presents dated decisions, missing/stale warnings, tradeoffs and assumptions. Missing cash or failed inventory reads remain unavailable, not zero. Currency balances and obligations stay separate; no exchange rate is invented. Overdue records require reconciliation, not an assertion of non-payment.

Cash reserve arithmetic excludes future receipts, taxes and unknown costs. Order scenarios reuse the existing demand model, require a saved manual ad plan and sufficient records, and are labelled provisional. Detailed forecasts/settings are collapsed; existing sale controls remain available and their backend is unchanged. A real Responses API adapter is implemented behind the explicit Generate AI advice action. It is unconfigured and has not been called live. Deterministic actions are explicitly labelled. No spending, payments, orders, sale activation or customer promises execute from this view.

## Acceptance and remaining checks

1. Existing-account login → Content; save/reload a draft and shared goal; stale-version saves conflict rather than overwrite. Viewer remains read-only.
2. Calendar month/year/leap boundaries show correct dates; saved post opens on its due/planned day. Moving editorial fields forces renewed review.
3. Studio is locally linked. Sign in with the existing account, open Content → Image Studio and check existing images/reference selection before any deliberately authorized generation.
4. Demand shows actual available records, explicit unavailable cash if Wise is missing, no invented numeric goal, and dated reconciliation decisions for past-due records. Saving draft ad plans never invokes an ad mutation.
5. Customers retains its existing records and workflow; authenticated browser checks remain outstanding. Sale/send/checkout execution was not tested.

Automated verification: 81 application tests and 7 in-memory SQL policy tests pass. TypeScript and targeted TS/TSX lint pass. SQL tests use synthetic identities/data and do not touch the live database. Browser end-to-end acceptance, missing decision-provider inputs and a saved business outcome remain outstanding. No deployment, publishing or production business-record write was performed by this milestone.

## Exact data sources versus manual input

- Cash: existing `lib/wise/client.ts` balance/profile/statement reads with a five-minute server cache. Requires existing `WISE_API_TOKEN`; absent in this isolated environment, so the view says unavailable. No Wise credential was copied. Bank Meta-labelled CAD expenses over the last 30 days supply historical spend only, not a confirmed campaign budget or causal performance measurement.
- Stock: session-authenticated Supabase `inventory`, `available_qty - reserved_qty`, grouped by fabric/module; `updated_at` drives stale warnings.
- Orders: Supabase `shopify_orders`, recent 30 days, CAD, PAID, noncancelled, positive modules; line-item Shopify JSON supplies product revenue. Reads the existing imported records; does not invoke a Shopify import/API. A 1,000-row cap or missing fabric blocks scenarios.
- Arrivals/obligations: `container_entries` manifests/ETA/status/payment balance, `major_expenses` open records, `wayflyer_payments` scheduled records. Container currency uses an explicit field if present, otherwise the existing legacy USD convention; reconcile that convention before relying on coverage. No live payment status is asserted.
- Manual: objective, target date, cash-reserve/new-order target, daily CAD ad plan and dated work come from the saved operator business plan. Lead/buffer days, acquisition assumptions and sale lift remain existing `demand_planning_settings` inputs. Sale state comes from the preserved sale store.
- AI: `lib/strategy-ai.ts` implements a real OpenAI Responses adapter following the existing app convention, plus strict structured output validation. The model/key are unconfigured; the current situation view remains deterministic until an explicit successful AI request. Existing Creative Lab retains its own provider setup; the combined admin never reads that key.

Browser discovery found no callable browser-control/automation tool. `open_in_codex` only opens UI; screen-context capture is restricted to active voice calls. Headless Chrome rendered the actual components with in-memory synthetic fixture data into `../evidence/synthetic-{calendar,strategy,studio}.png`, prominently labelled. These screenshots verify layout, not a signed-in session or live data. No user browser profile/cookies were accessed.

## AI decision adapter acceptance and setup

The server adapter posts to the same OpenAI Responses API used by existing voice routes, with `store:false`, strict JSON schema, no tools, no automatic retries and no execution mechanism. It requires both `OPENAI_API_KEY` and `OPENAI_STRATEGY_MODEL`; neither was set or copied. There is deliberately no default model/version. Choose an account-approved model with strict Responses structured-output support. Configure the server environment only under separate authorization; API use can incur charges. No dependency installation or credential creation is required by this adapter.

`POST /api/demand-advice` authenticates owner/admin and same-origin JSON before loading a fresh session-scoped snapshot. Client-provided facts/prompts are ignored. The packet contains aggregate balances, commitment totals, module counts, goal comparison, model calculations and generated limitations. It excludes raw customers/orders/bank transactions, customer messages, user-written objective text and commitment labels. Stale request snapshots older than five minutes are rejected. Missing cash/stale or unavailable source warnings restrict output to review advice. Each recommendation needs exact known fact IDs/values, deterministic calculation IDs, tradeoff, assumptions and approval; all limitations must be returned. Unknown facts, unavailable values, numeric claims in narrative, extra fields and execution attempts fail validation. Semantic truth of freeform qualitative proposals still needs human review; structural evidence validation cannot prove every prose assertion.

The UI displays the exact missing config before any provider request and never calls automatically. Automated tests use injected fetch mocks exclusively, covering absent config/cash, stale snapshots, malformed/refused output, unsupported evidence, PII exclusion and no-execution guarantees. Next live acceptance requires explicit provider configuration and a deliberately authorized AI request; no paid call has been made. Official request contract: https://developers.openai.com/api/docs/guides/structured-outputs .

## Approved local provider configuration

Tyson authorized reuse of Creative Lab's existing OpenAI credential. The isolated `.env.local` now contains the server-only key and explicit `OPENAI_STRATEGY_MODEL=gpt-5.4`, selected after official documentation confirmed Responses API and structured-output support. The file is excluded and mode 0600; the original credential file is unchanged. No provider request, generation, deployment or business action was made. Configuration readiness is confirmed; credential validity, account model access and live output quality remain unverified. Earlier unconfigured descriptions above describe the implementation milestone before this approved setup.

## One authorized synthetic provider test

Exactly one real adapter call used synthetic evidence, standard tier gpt-5.4, no tools/retries, a 16,000-byte request guard, 2,048 maximum output tokens including reasoning, and reasoning effort none. Current official pricing was verified at US$2.50/M input and US$15/M output. A conservative 32,768 input-token allowance gave a US$0.11264 bound, below the approved US$1 cap.

The provider returned HTTP200/completed. Usage: 443 input, 661 output, 0 cached, 0 reasoning; estimated token charge US$0.0110225 (not an invoice). Production validation correctly rejected a fabricated evidence ID; another recommendation also omitted its calculation reference. The advice was not accepted. The schema now enumerates allowed non-null facts/calculations and requires a calculation reference. Offline regression tests pass; this fix has NOT had another live test. No further paid call is authorized by the completed test. Evidence: `../evidence/one-approved-ai-test.result.json`. Authenticated browser and real business-data acceptance remain unverified.

## Three additionally approved synthetic checks

The tightened actual adapter accepted three completed HTTP200 responses: complete synthetic operational evidence (601 input/652 output tokens), missing cash (554/597), and stale stock (614/741). Missing-cash/stale-stock recommendations were review-only, all proposals retained human approval and execution disabled. Cached/reasoning tokens were zero. Estimated combined charge: US$0.0342725 against the approved US$1 combined cap. Conservative combined request bound: US$0.33792. Exactly three requests; no retries. The allowance is exhausted. Results validate these synthetic samples only, not real business-data quality, authenticated browser acceptance or broad recommendation reliability. Evidence: `../evidence/three-approved-ai-tests.result.json`.

## Wise source-status fix and visible cash summary

`Cash · Wise` is now a visible server-rendered section near the top of Demand & Sales, inside the existing owner/admin financial-access guard. It uses the same Wise integration, groups returned amounts by currency without conversion and displays API retrieval time, balance status and statement status/time. It introduces no additional primary tab or login. Missing/stale balances render unavailable, never a fabricated zero. Partial balances remain visible but are explicitly incomplete and reserve comparisons are provisional. Successful explicit zero amounts remain zero.

The reader now isolates profile/balance/statement failures. Statement errors no longer erase usable balances or silently become zero ad spending. Malformed/missing amounts are rejected, partial reads retain known records, and statement coverage is returned explicitly. Source timestamps describe completed API reads, not bank settlement/update time. Decision/CAC spending is withheld for failed, partial, stale, legacy undated or insufficient-window data. Financials and CAC show the same status distinctions. Historical scenario budgets remain blank until a usable measured baseline or an explicit scenario input exists. The existing merchant-match, absolute-value and May-exclusion classification rules are preserved and disclosed; no new bank classification claim is made. Read requests have a bounded timeout and no automatic retries.

Demand caching uses a new key to avoid older undated summaries. The revalidation target remains five minutes; a separate timestamp-age check rejects snapshots beyond five minutes instead of assuming revalidation guaranteed freshness. No live Wise request, credential access/configuration or hosted endpoint retry was performed while testing this fix. The blocked hosted endpoint remains blocked. Tests use injected synthetic readers only.

A separately authorized deployment into the **existing Luun project and environment** can continue reading the same server environment variable names, preserving its already configured Wise token without pulling/copying it. A new project or other environment would not automatically inherit that configuration. The exact project/environment mapping and deployed connection health remain unverified because restricted Vercel resources were not accessed. This is a code-readiness path, not a deployment performed or a request to log in to Wise.

Parent-reported authenticated browser acceptance: Content's month calendar, embedded Studio with real references/collection, Demand goals/advice controls and Customers workspace rendered in the existing local session. No save, generation, advice or sync ran. This closes visible navigation acceptance for those screens, not financial workflow acceptance. The local sale controls showed missing Supabase server configuration; no service credential was copied. The newly added dedicated cash section has component-render tests; its browser rendering remains for the separate read-only browser task to confirm.

Wise-fix final verification: 81 application tests and 7 isolated SQL tests pass, with TypeScript, targeted lint and production compilation passing. See `../evidence/wise-status-fix-verification.json`.

## Offline operating loop — current state

Upstream Wise requests are now **off by default**, independently of whether the server has a token. `getWiseSummary`, the low-level Wise fetch helper and connection diagnostics all stop before network access unless the explicit request-enable switch is set. This task does not enable it. Demand bypasses old caches while off, and the agent briefing forces Wise suppression regardless of that switch. Tests invoke the actual server reader/diagnostic code with synthetic configuration and assert zero fetches. No token was read/copied/configured by the agent, no Wise login or request was made, and the blocked hosted route was not retried. Offline mode does not relabel old amounts as current. No actual balances have been fabricated.

The cash component groups returned accounts as corporate/business, personal or unclassified, preserving separate currency totals and timestamps/status. No FX rate/conversion is inferred. Business reserve calculations exclude personal/unclassified balances. All grouping checks use synthetic data; actual upstream values remain unknown/offline.

The shared **Next work & decisions** loop appears across the existing three areas. It combines saved dated actions/decisions, content-review dependencies, active non-test customer tickets and deterministic Demand decisions. Users can adopt a source item as a follow-up with an explicitly confirmed due date, then record completion/decision evidence through the existing owner/admin plan API. No date is invented and no communication, spending or publishing occurs. Existing Customers and Content surfaces remain the place to review their source records. Evidence is a user-recorded claim/reference, not independent verification that an external action occurred.

Work area, action/decision kind and optional source record IDs use optional fields in the **existing plan JSON**. No migration/DDL/live database write was made. The existing RPC preserves them, enforces role/version gates, records audit events and requires evidence before done. An additional in-memory SQL test verifies this exact contract. Every shared-plan save currently advances the context version, so already approved content may require renewed review even for a work completion update; finer dependency/version granularity is a future scoped database change, not silently applied here. The current plan caps commitments at thirty; no unbounded background queue is claimed.

`GET /api/operator/brief` is a private, session-authenticated read endpoint; the UI downloads its versioned `luun-agent-brief.json`. It contains the saved goal/context, dated work/decisions, blockers, completion references, source timestamps and sample caps. Customer names, email addresses and message bodies are omitted. Financial Demand details are included only for owner/admin. Cash is explicitly offline. Failures or capped samples remain visible. The synthetic round-trip tests cover save → briefing → evidence-backed completion → reload, stale-version rejection, source adoption and PII omission.

**Dot connection gap:** this parent conversation is not automatically connected to the app. No custom app connector, MCP endpoint, OAuth delegation or background worker was installed. The local loopback app cannot be reached directly by a cloud agent. A future connection needs an authorized reachable deployment plus explicit least-privilege authentication and connector installation/configuration. Never export browser cookies or share a service-role key to bridge this gap. Read briefs and proposed updates must retain existing roles, version checks and review gates. Current use is the in-app loop or a user-downloaded brief; no external messaging, scheduling or autonomous execution is implied.

Deployment remains parked: project/environment identity and permission are unresolved, previous Vercel detail denial remains respected, hosted Wise route access remains blocked, and no production environment settings were pulled or changed. Existing hosted configuration can be retained on an eventual separately authorized deployment into the same verified project/environment; do not copy tokens into this checkout or enable Wise requests under the current restriction. Local sale controls still need their existing server configuration; it was not copied.

Final offline-loop verification: **89 application tests + 8 isolated SQL tests pass**; TypeScript, targeted lint and production compilation pass. The new brief route returns 401 without a session. Detailed evidence is `../evidence/offline-operating-loop-verification.json`.

## Final operating-loop integration review

Review fixes: reject duplicate open follow-ups for the same area/source at the app-validation boundary; suppress duplicate ticket/content source rows while a corresponding follow-up is open; handle record-ID collisions without inheriting another source's metadata; validate/fix source-area navigation to fixed internal links; verify a selected completion still targets an open saved commitment; retain immutable planned instants while grouping in the browser-requested validated IANA timezone; compute planned overdue status by instant and date-only overdue status by that timezone's date. UTC is the explicit API fallback.

The workspace is intentionally shared between authorized profiles rather than isolated per user. Existing RLS/RPC role, actor/audit and version/evidence checks remain the authority; no new access or schema was created. Raw source IDs never grant record access or execute actions. Owner/admin financial brief loading is separate from role-permitted shared content/customer reads. Current parent Supabase tools can read approved shared tables on an explicit authorized request; this does not establish a persistent custom Dot connector or automation.

The isolated server was restarted with **LUUN_WISE_REQUESTS_ENABLED=0 explicitly in its launch environment**. Listener PID11942 served the isolated checkout; Creative Lab PID91504 remained untouched. No process environment values or secrets were dumped. See `../evidence/isolated-server-offline-launch.json`. Upstream Wise calls remain prohibited. Build/test review uses the same explicit offline flag where relevant.

Use-now and exact future deployment/environment requirements, without secret values, are in `deployment-readiness.md`. No deployment or access creation was performed.

## Brief export/read fallback

Read-only browser acceptance confirmed shared work across all three tabs, dated/overdue/source controls, the plan editor, source timestamps/timezone and cash-offline status with no Wise calls. The plan remained v0/not saved, so live completion UI was not exercised; synthetic persistence/RPC tests cover it. A previous explicit download event timed out with **uncertain outcome**; it was not retried and no Downloads folder or browser session was inspected.

The previous Blob flow revoked its URL immediately after a detached-anchor click, a plausible browser download race rather than a confirmed diagnosis of that timeout. Export now performs one user-triggered same-origin authenticated read of `?download=1`, validates HTTP status, JSON MIME/attachment headers and the brief envelope, attaches the download anchor before clicking, and keeps the Blob URL alive for sixty seconds. The server emits application/json, Content-Disposition attachment, private/no-store and nosniff headers. Failures produce in-app errors; success means **download requested**, not proof of browser completion. No background export/upload or external send occurs.

The in-app **View / copy agent brief** disclosure renders read-only selectable JSON. Its explicit Copy button uses the local clipboard and reports failure with a manual-select fallback. No file download is necessary to read/use the context. Three synthetic export tests verify deferred revocation, MIME/disposition handling, malformed/denied responses and click failure. The new download flow has not been retried against the user's browser.

## Dynamic cash correction

The requirement is dynamic balances, not stored snapshots. The existing cash section now has a balances-only authenticated refresh path, separate from statement history, with corporate/personal currency grouping, original retrieval timestamps, partial/error handling and a coalesced sixty-second per-runtime cooldown. No automatic upstream polling was added. Legacy statement-based metrics stay unavailable unless separately enabled. Current runtime request guard remains0 and no credential/config change or live Wise request occurred; live-read clarification is pending with the parent. See deployment-readiness.md for exact boundaries and setup.
