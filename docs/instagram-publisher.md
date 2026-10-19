# Luun Instagram publisher — LOCAL, NOT DEPLOYED

The existing Content calendar now has a connection control, private JPEG upload,
Schedule saved approval, and Draft / Scheduled / Published / Failed delivery
labels. Existing review states and manual publication evidence remain separate.
Single-image JPEG feed posts plus an Instagram inbox and approval-first text
replies are implemented. Reels/carousels and automatic replies are not implemented. No Instagram account was connected, token generated,
credentials configured, media uploaded, job activated or post/message sent here.

## Connection and account

Only the new Luun Publisher-IG app is intended:
- Instagram product App ID: `1820435792490081` (public identifier).
- Expected Instagram account ID: `1784147235520052`, `luun_official`.
- The tester invite and account link are already accepted; do not repeat them.
- Callback implemented locally, not registered or deployed:
  `https://luun-admin-et42.vercel.app/api/instagram/callback`.
- Requested scopes are exactly `instagram_business_basic`,
  `instagram_business_content_publish`, `instagram_business_manage_messages`.
- Outbound sending defaults off and requires a separate explicit activation approval.
  A manual, approved-reply endpoint exists; no automatic reply handler or live
  webhook subscription exists.

`POST /api/instagram/connect` requires a signed-in owner/admin and same-origin
JSON. A short-lived, secure HttpOnly cookie and a single-use hashed database
nonce bind the callback to that session. Callback consumes the nonce before
exchange, checks the expected account and exact granted permissions, exchanges
for a long-lived token, then stores AES-256-GCM ciphertext bound to app/account.
Only safe connection metadata reaches the browser. API requests use a server-only
HTTPS transport, not Next fetch URL instrumentation. Do not enable URL/body query
logging for the provider OAuth/token endpoints or callback in platform tracing.

Tokens refresh only server-side near expiry, with a short database refresh lease.
Expired/revoked/undecryptable credentials stop publication. The encryption key
must remain available in protected server configuration; changing it without a
reviewed key migration makes existing ciphertext unreadable. No production key
was generated or stored by this task.

## Exact approval and publishing

Upload an explicitly selected JPEG using the calendar upload control; files stay
in a private bucket and receive immutable UUID paths plus SHA-256 metadata. This
is a separate action from choosing a Mac-only Creative Lab reference. Supported
files: JPEG <=8 MB, width 320–1440 px, aspect ratio 4:5–1.91:1. Save/review the
caption, uploaded media and device-local planned time, then save approval. Times
are normalized to UTC. Editing time now invalidates approval, along with caption
and media changes.

Schedule saved approval pins account, post version, exact caption, UTC time,
media ID/path and content hash. It creates one unique job per post revision;
ordinary Save never schedules/publishes. Updating a queued post cancels its job.
While publication is underway or outcome is uncertain, edits are blocked to
avoid changing an in-flight approval. Published revisions require another draft.

The separately authorized worker endpoint is `/api/internal/instagram-publish`.
It requires the existing protected `CRON_SECRET` and
`INSTAGRAM_PUBLISHING_ENABLED=1`; it is disabled otherwise. No cron entry was
added or activated. A production scheduler needs a cadence adequate for the
selected time (normally once per minute, subject to the hosting plan).

Each worker claims one due job with an expiring lease. Creation/publishing stages
are durable BEFORE sending those requests. Bytes are checked against the approved
hash before Meta receives a signed media URL. The container is polled until ready;
only then is the approved container published. A job missed by >15 minutes fails
rather than unexpectedly posting old content after downtime. Definite failures
are Failed; change the time, save Needs review, approve, then explicitly schedule
a new revision after correcting the cause.

If a create response is lost with no container ID, creation is NOT retried.
If publication is uncertain, the same known container is reconciled. PUBLISHED
confirms success; FINISHED is NOT treated as permission to resend. Unknown states
remain Scheduled / checking confirmation with editing/resend blocked. Human
reconciliation is required if Meta cannot establish the result; there is no
unsafe force-retry button or caption-based guessing. A successful publication
stays Published even if permalink metadata cannot be retrieved.

## Database scope for approval — NOT APPLIED

`docs/instagram-publishing.sql` is an unapplied migration DRAFT, not an installed
migration. The Supabase CLI is not installed in this workspace; generate the
versioned migration from this reviewed file using `supabase migration new` before
application. Do not execute it as part of local tests.

It adds four tables: `instagram_connections` (encrypted credentials),
`instagram_oauth_attempts` (hashed expiring state), `instagram_media` (immutable
media metadata), `instagram_publish_jobs` (snapshot, durable stages, provider IDs,
lease, safe diagnostics). RLS is enabled; anonymous/authenticated table access is
revoked. Scoped RPCs are SECURITY INVOKER and callable only by service_role.
A private `instagram-media` bucket has no new browser grants/policies. An invoker
trigger on existing content posts invalidates queued jobs and rejects changes
while a publication is active/unknown/confirmed. Existing business-plan rules,
permissions, records and other panels are unchanged. No schema/security changes
were applied. SQL has not been run against PostgreSQL: migration application,
RLS/role execution and real concurrency still require isolated database testing
before production approval.

## Production setup still required, in order

1. Review the exact database/bucket/trigger scope above, generate the versioned
   migration and validate it against an isolated database. Obtain approval before
   applying any production migration/security changes.
2. Configure only this app's Instagram product App Secret and an independent
   32-byte base64 token-encryption key in protected server settings. Never put
   tokens, secrets or full OAuth callback URLs containing codes in chat/logs.
   `.env.example` lists names only. Pin `INSTAGRAM_GRAPH_API_VERSION` to the
   supported version selected for this app; the test fixture version is not a
   production recommendation. Keep the publishing flag off.
3. Approve deployment of this bounded change, register the exact callback in the
   Luun Publisher-IG app, and complete required privacy/data-deletion setup in the
   Meta dashboard. Data-deletion/deauthorization callbacks are NOT implemented in
   this first slice; use a valid reviewed deletion-instructions URL if supported,
   or add those handlers before a release requiring them. Confirm granted access
   for all three scopes. Standard access is limited to the applicable owned/
   managed role/tester scope; wider use requires Advanced Access/App Review and
   any dashboard verification requirements. Existing acceptance is not proof
   that every requested permission is granted.
4. Only after approval, enable the connection flag and let the owner click
   Connect Instagram on the official consent screen. No pre-generated token is
   needed. Verify the returned account ID matches the configured expected ID;
   a mismatch fails closed, rather than silently switching accounts.
5. Obtain explicit approval before enabling the live worker/scheduler or making
   any test post. No test publication was authorized or performed here.
6. Review `docs/instagram-messaging.sql`: two additional server-only tables for
   incoming DMs and versioned reply approvals, with account/message deduplication,
   RLS and service-only operations. No existing inquiry/email records are merged.
   Validate/apply only after separate migration approval. Configure the webhook
   verification token and the correct Luun Publisher-IG Meta app signing secret
   privately. The locally implemented GET/POST webhook URL is
   `https://luun-admin-et42.vercel.app/api/instagram/webhook`.
   Register/subscribe only after explicit approval, with only message events needed
   for this inbox. Keep webhook and outbound-message flags off until then.
7. Manual reply sending is a separate activation boundary. Only after explicit
   approval may `INSTAGRAM_OUTBOUND_MESSAGES_ENABLED=1` be configured. Every
   response still requires a saved draft, approval and explicit Send. There is no
   auto-response switch or scheduled DM sender.

Official API use does not guarantee freedom from account restrictions. Respect
Meta's policies and returned limits; no browser automation, scraping, Ads API,
DM automation or engagement automation is included.

## Instagram inbox and replies

Customers → Instagram (`/ticketing?view=instagram`) is limited to owner/admin.
The inbox loads only this configured Instagram account's stored inbound messages;
plaintext is rendered as text, never HTML or instructions to an agent. Peer IDs
are scoped to this account. It does not invent Shopify/email matches.

Webhook verification checks the exact challenge token. POST checks HMAC-SHA256
against bounded raw bytes before parsing. Both the entry account and recipient
must match. Echoes/own messages are excluded; duplicate delivery is ignored by the
composite account/message primary key. Receiving never triggers a send or AI.
Attachments are represented by a placeholder; no external attachment URLs are
fetched, displayed or scraped.

Replies pin the account, recipient, incoming message, exact text and version.
Editing requires another approval. Send is owner/admin-only, same-origin and
explicit, and claims the approved revision atomically before calling Meta.
Replies are limited to 1000 text characters and the conservative 24-hour window
from the selected inbound message, with no message tags or marketing extensions.
A lost response remains unknown with resending blocked; an interrupted sending
state is also blocked until human confirmation. No guessed delivery/retry occurs.
Sent/unknown replies cannot be edited; the owner must resolve uncertain outcomes.
No live messages have been received, read or sent in this task.

## Local verification (no provider calls)

```sh
./node_modules/.bin/tsc lib/content-database.test.ts lib/content-calendar.test.ts lib/instagram/instagram.test.ts lib/instagram/messages.test.ts --module commonjs --target es2022 --esModuleInterop --outDir /tmp/luun-instagram-tests --skipLibCheck
node --test /tmp/luun-instagram-tests/content-database.test.js /tmp/luun-instagram-tests/content-calendar.test.js /tmp/luun-instagram-tests/instagram/*.test.js
npm run test:content
npm run typecheck
LUUN_VERIFY_BUILD=1 npm run build
```

The tests inject mock transport/repository ports. They do not connect to Meta,
Supabase, private storage or the existing Instagram account.

References:
- https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/documentation/instagram-platform/content-publishing

## Focused integration review — production gate remains closed

Local review corrected the publishing start lock order to match the content-save
trigger (post row before job row), added explicit null/shape guards to service
RPC inputs, preserved the first event when a batch contains conflicting duplicate
message IDs, and retained positive provider acknowledgements after a failed
storage response. Recovery repeats persistence only, never a provider mutation.
OAuth callback checks are factored for mocked testing of browser state, verified
actor binding, duplicate parameters, denial and single-use consumption.

With the owner's approval, PostgreSQL 17.10 was installed only in the ignored
`.local-content/instagram-postgres-runtime` folder. Exact isolated dependencies:
`@embedded-postgres/darwin-arm64@17.10.0-beta.17` and `pg@8.23.1`.
No global install, lifecycle scripts, startup service or TCP listener was used.
The package wrapper has a beta suffix; the binary reports PostgreSQL 17.10.

Run `node tests/instagram-postgres.test.cjs` from this repository to repeat the
real database tests. Each run creates a fresh private temporary database and Unix
socket using synthetic data, applies the existing operator-workspace migration
and both SQL drafts, and stops the server afterward. Successful runs delete their
temporary database. The isolated runtime remains available for reruns.

All 18 real PostgreSQL checks pass: table/RPC permission denials, existing
viewer/logistics content permissions, single-use OAuth state, exact approved
account/media/time/revision, concurrent scheduling, publish/edit lock ordering,
stale/expired leases, refresh serialization, webhook message deduplication,
account-isolated replies, concurrent send claims and blocked unknown outcomes.
The added identity test exposed missing container-ID requirements and permitted
provider-ID replacement. The draft now requires a container in ready publication
stages and makes provider IDs write-once, while allowing same-ID persistence retries.

This fixture stubs Supabase Auth and Storage schemas. It tests PostgreSQL grants,
RLS flags, transactions, triggers and RPC execution, but does not validate the
Supabase API gateway, production grants/configuration, real storage uploads or
actual Meta interoperability. Production migrations were applied after owner approval on October 19, 2026; the isolated test fixture itself never touches production.

Meta app access levels, Live/published-mode eligibility, all three permission
grants, App Review and any business-verification requirements remain unverified.
The existing accepted tester and linked professional account must not be repeated
as a setup task, but do not prove that external production use is permitted.
Provider-specific response shapes/account identifiers also require approved
connection verification. Platform query/body log redaction must be checked before
real OAuth. The local application never intentionally logs codes, token payloads,
signed media URLs or raw provider diagnostics.

## Approved production release — October 19, 2026

The owner approved only these database changes and the application deployment,
with all Instagram capabilities disabled. Applied migration history:
`20261019205456_instagram_publishing` and
`20261019205505_instagram_messaging`. Copies match the tested SQL drafts.
Production inspection confirms six empty tables with RLS and no PUBLIC/anon/
authenticated access, eleven service-role-only public invoker RPCs, the private
trigger and private JPEG bucket. No existing content grants were expanded.

`vercel.json` explicitly pins connection, publishing, webhook reception and
outbound messaging flags to `0`. The existing source-sync cron is unchanged;
there is no Instagram cron. No secrets, OAuth attempts, subscriptions, provider
connections, posts or messages were created. Credentials and live account setup
require a separate approved step. Existing accepted tester/account linking remains
valid; do not repeat that setup.
