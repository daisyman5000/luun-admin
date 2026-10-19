# Luun Instagram connection and publisher

## Current boundary

The app and the two Instagram database migrations are deployed. Only the owner/
admin connection flow is enabled. Publishing, live webhook reception and outbound
sending remain disabled, and there is no Instagram cron or automatic reply flow.
No live OAuth, Meta request, post, DM or subscription is executed by the tests.
A successful mocked flow is not proof that the live account has connected.

Only Luun Publisher-IG is intended. The Instagram product app ID is
`1820435792490081`; the approved professional account ID is pinned in code to
`17841472352520052` (`luun_official`). Existing tester/account acceptance is complete;
do not repeat it or create a pre-generated token. The owner reports the dashboard
shows the own-business developer exemption from App Review. Do not broaden app
access or requested permissions as part of connection troubleshooting.

## Server configuration

Production credentials are entered by the owner in Vercel project settings.
There is no credential-entry form in the app. Never request secret values or
complete OAuth callback URLs in chat, logs, telemetry, source or Git.

| Setting | Purpose |
| --- | --- |
| `INSTAGRAM_APP_ID` | Instagram product app ID above |
| `INSTAGRAM_ACCOUNT_ID` | Must equal the pinned approved professional account |
| `INSTAGRAM_REDIRECT_URI` | Exact HTTPS callback below |
| `INSTAGRAM_GRAPH_API_VERSION` | Explicit supported version selected for the app; no guessed default |
| `INSTAGRAM_APP_SECRET` | Correct product secret; Sensitive server-only Production variable |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | Existing independent 32-byte base64 key; Sensitive server-only Production variable |

Do not regenerate, rotate or overwrite the encryption key during troubleshooting.
It is required to decrypt existing credentials. The existing Supabase URL/public
key must match the confirmed project, and the existing server secret must permit
server-only storage. No Supabase credential is exposed to the browser by this flow.

Current feature flags in `vercel.json`:

- `INSTAGRAM_CONNECTION_ENABLED=1`
- `INSTAGRAM_PUBLISHING_ENABLED=0`
- `INSTAGRAM_WEBHOOK_ENABLED=0`
- `INSTAGRAM_OUTBOUND_MESSAGES_ENABLED=0`

Connection and status require a signed-in owner/admin. Missing or invalid settings
are shown by name only, behind that authorization check. Vercel environment,
settings and runtime-log reads have been denied with 403; do not retry or bypass
those denials. No secret value was retrieved for verification.

## Reviewed Instagram Login flow

Implemented callback:
`https://luun-admin-et42.vercel.app/api/instagram/callback`

1. Same-origin JSON `POST /api/instagram/connect` verifies the signed-in role and
   server configuration. It stores a hashed, actor-bound, ten-minute nonce and sets
   a Secure HttpOnly SameSite=Lax state cookie before returning the official
   `https://www.instagram.com/oauth/authorize` destination.
2. Requested scopes remain exactly `instagram_business_basic`,
   `instagram_business_content_publish`, `instagram_business_manage_messages`.
   No Facebook-login fallback or Ads permission is requested.
3. Callback verifies owner/admin, exact callback origin, unique parameters,
   browser state and a single-use unexpired actor-bound database nonce. Denial,
   replay, missing code or changed browser state cannot exchange tokens.
4. The server posts the authorization code, app ID/secret and exact redirect URI
   to `https://api.instagram.com/oauth/access_token`. HTTP and parser errors are
   replaced by fixed error codes, never raw provider diagnostics.
5. The raw response is parsed with pinned `lossless-json@4.3.2`, with no native
   `Response.json()` numeric conversion and no unsafe fallback. Numeric `id`,
   `user_id`, `recipient_id` and `message_id` literals become exact decimal strings.
   Expiry stays numeric. Invalid numeric IDs, conflicting duplicate fields,
   malformed/oversized JSON and ambiguous records are rejected. The library has
   no runtime dependencies and does not depend on new JSON reviver runtime support.
6. Flat records and one-record `data` arrays are supported. Short-token fields
   must include a nonempty token, valid scoped `user_id` and all three permissions.
   Permission arrays and comma-separated strings are supported; whitespace is
   normalized, but missing or additional permissions still fail. Any provided
   `token_type` must be Bearer.
7. Token-bound `GET https://graph.instagram.com/<version>/me` requests
   `id,user_id,username` using the short token in the Authorization header.
   Token `user_id` and profile `id` are app-scoped; profile `user_id` is the
   professional account ID. Scoped IDs must agree, and the professional ID must
   equal the configured and pinned approved account. No returned ID replaces it.
8. Only after that identity check does the server request
   `https://graph.instagram.com/access_token` with `grant_type=ig_exchange_token`.
   The long token must have valid positive integral expiry metadata and a valid
   Bearer type if supplied. The long token's profile is checked again for the same
   scoped and professional identities before credentials may be stored.
9. The storage boundary independently checks the pinned professional ID. The token
   is encrypted with AES-256-GCM, a random IV and app/account-bound authenticated
   data, then upserted into the server-only connection table. Only safe metadata
   reaches the browser. The callback clears state and redirects with a fixed
   success/failure indicator; it sets no-referrer and no-store headers.

The server uses fixed Meta HTTPS hosts, timeouts, a bounded response body and no
redirect following. It avoids Next fetch URL instrumentation for token requests.
Application code logs no callback parameters, token bodies, signed media URLs or
provider diagnostics. Platform logging/redaction cannot be confirmed through the
currently denied Vercel settings/log connection.

Expired/revoked/unreadable credentials fail closed. Refresh uses the documented
`ig_refresh_token` endpoint under a database lease when a separately authorized
server operation needs it; there is no newly activated refresh scheduler.

## Safe failure details and owner acceptance

Only a fixed stage/reason pair is retained for ten minutes in a Secure HttpOnly
SameSite=Lax cookie scoped to `/api/instagram`. No IDs, state, code, token, secret,
provider response or personal data is included. Status checks authorize owner/
admin before reading it; malformed/non-allowlisted values are discarded. Success
or a fresh connection start clears stale diagnostics. Nothing is added to logs
or a diagnostic table.

After a verified release, the owner refreshes `/content` and starts one fresh
**Connect Instagram** attempt. Do not replay an old callback/code. Successful
acceptance means the page shows the expected account connected, a server-only
connection exists with valid expiry/permissions, and outbound flags remain off.
If it fails, share only the displayed two `Connection check` codes. Earlier generic
failures cannot be reconstructed; do not ask for credentials or repeated blind
retries. Live success awaits this final owner-controlled step.

## Database and downstream scope

Applied migrations are `20261019205456_instagram_publishing` and
`20261019205505_instagram_messaging`. Versioned copies match the reviewed SQL drafts;
do not reapply them. They add six RLS-protected server-only tables, scoped invoker
RPCs, one content approval trigger and the private JPEG bucket. Browser-role
access is revoked, and existing grants were not broadened.

Credential rows, encryption binding, approved snapshots, media/publish/message
paths and inbox/reply filters continue to use the canonical professional account
ID. Login-scoped IDs are used for handshake consistency only, not persisted as
an alternate account or substituted into downstream routes.

JPEG uploads and scheduling require explicit owner actions and saved approvals.
Media/caption/time/revision changes invalidate approval; in-flight or unknown
publications cannot be blindly retried. Existing manual calendar evidence remains
separate. Supported media is one JPEG <=8 MB, width 320–1440px and ratio 4:5–1.91:1;
Reels/carousels and automatic replies are not implemented.

The worker endpoint `/api/internal/instagram-publish` remains protected by the
existing server scheduler secret and its disabled publishing flag. There is no
Instagram cron. Reception uses implemented GET/POST
`https://luun-admin-et42.vercel.app/api/instagram/webhook`, but remains disabled and
unsubscribed. Its future setup needs separately approved protected verification
and signing secrets, registration and message-event subscription. Sending also
requires separate activation; each reply still needs a saved draft, approval and
explicit Send within the response window. No automatic reply switch exists.
Privacy/deletion setup must follow Meta's requirements; dedicated deletion and
deauthorization handlers are not implemented. Do not claim platform registration,
external-user eligibility or freedom from account restrictions from local tests.

## Repeatable verification

```sh
npm run test:instagram
npm run test:operator
npm run test:planning
npm run test:checkout
npm run typecheck
npm run build
```

The Instagram suite covers raw wire JSON through the actual callback, transport,
client, identity, encryption and storage code with synthetic HTTP/database ports;
there are no live provider calls. Separate PostgreSQL tests use a fresh private
Unix-socket database and synthetic roles/data, then stop and remove it. Supabase
Auth/Storage schemas in that fixture are stubs; platform interoperability still
needs approved owner verification. The legacy operator SQL suite supports an
isolated PGlite test runtime via `LUUN_TEST_PGLITE_MODULE`.

Reviewed references:
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started
- https://developers.facebook.com/documentation/instagram-platform/reference/access_token
- https://github.com/josdejong/lossless-json

### Profile diagnostic clarification

The profile request explicitly asks for `id,user_id,username`. Meta documents `id` as app-scoped and `user_id` as the professional account ID. Both pass through the raw-byte lossless parser before comparison. App ID `1101144599508064` (Meta dashboard), Instagram product app ID `1820435792490081`, and professional account ID are separate namespaces. The intended public profile is `https://www.instagram.com/luun_official/`; that URL alone does not verify its numeric professional ID.

The former `profile · account_mismatch` code combined several predicates and cannot identify which one failed historically. New owner-only fixed reasons distinguish `configured_account_mismatch`, `professional_id_missing`, `professional_id_invalid`, `professional_account_mismatch`, and `profile_username_missing`. Scoped-ID disagreements retain `account_match · account_mismatch`. No account ID, username, token or provider response is retained in these diagnostics. A mismatching account is still rejected before long-token exchange or credential storage. Do not substitute the app-scoped ID, bind by username, or change the approved pin to make a connection pass.

This diagnostic clarification requires a new deployment before it can explain a future owner-authorized connection attempt. It does not fix or establish the cause of the prior live profile mismatch. Existing callback data was discarded; no stored connection exists from that failed attempt. No credential edits or OAuth attempts are part of this patch.

### Prepared Admin operating controls

The owner/admin controls are rendered under Instagram on `/content`; the inbox link opens `/ticketing?view=instagram`. There are three separate settings: Publishing, Receive messages, and Send approved replies. All default **off**. A deployment flag is an upper limit; enabling a flag alone never enables an Admin setting. The controls are unavailable and every side effect fails closed when their database draft has not been applied. The existing successful account connection still displays independently.

The local, unapplied migration draft is `docs/instagram-operating-controls.sql`. No migration CLI is installed in this checkout, so no versioned filename was invented. After approval, generate a versioned migration using the CLI and apply the reviewed SQL to the exact approved project. It creates two RLS-enabled, service-role-only tables and two invoker RPCs; seeds only account `17841472352520052` with all settings false. Existing connection rows, encrypted credentials, jobs and grants are untouched. Each changed setting and its actor/before/after/version are saved in the same transaction; stale-tab changes are rejected. Nothing in an Admin payload can supply another actor or account.

Runtime gates are checked in the worker, webhook receiver and reply sender, including a fresh check immediately before unsafe provider create/publish/send operations. Turning off cannot recall an external request already sent. Calendar approval/version/media checks and reply draft/approval/24-hour protections remain in place. No automatic reply generation or sending is introduced. Metadata readiness does not read/decrypt token ciphertext or make Meta requests.

Publishing readiness requires the deployment flag, valid account/permissions, scheduler authentication and an authenticated worker check-in within five minutes. `docs/instagram-worker-cron.json` is a **proposed, unapplied** one-minute cron entry; merge it only after the persistent scheduler action is approved and the plan supports that cadence. `vercel.json` is deliberately unchanged. A worker with deployment permission but Admin publishing off records a heartbeat and processes no jobs. Jobs advance one durable stage per invocation, so the scheduler needs repeated invocations. Review queued jobs before enabling publishing.

Reception readiness requires the deployment flag, valid messaging account/permissions, verification token/signature secret presence and a successful callback challenge recorded by GET `/api/instagram/webhook`. A correct challenge may be verified while Admin Receive is off; POST events are not persisted while Receive is off. Meta app/account subscriptions are **not verified by this status**; a challenge timestamp is not proof that live customer events are being delivered. Use the official Meta callback/field/account-subscription setup separately, with exact approval for any credentials or persistent subscription. Sending is independent from reception: existing inbound messages may receive an approved deliberate reply while reception is off, within the existing 24-hour window.

Still-required external actions, not performed by this code change: apply the reviewed default-off SQL; approve the deployment flags needed for the chosen capabilities; configure the authenticated scheduler; configure webhook verification/signature credentials without exposing them; register/verify the callback and subscribe only the required messaging field/account in Meta. No secret entry fields exist in Admin. Enabling features, processing existing scheduled items, and sending a real reply are separate from shipping these default-off controls.

Validation: `npm run test:instagram`, `npm run typecheck`, `npm run build`. The draft SQL test is `npm run test:instagram-controls-sql` and uses the existing ignored local PGlite runtime; it never calls a hosted database. Tests exercise role denial, exact account pinning, stale versions, audit rollback, fail-closed readiness, UI request payloads, webhook signatures, scheduler authentication and off-before-provider guards. No live provider test is part of this suite.

### Calendar composer

The ordinary composer now has an actual private JPEG upload/preview, caption, Save draft and a deliberate publishing action. Click the calendar day to supply placement; there are no separate date/time, objective, brief, asset-reference or review-status inputs. Existing legacy metadata is retained. Save draft invalidates an old approval/queue; Schedule invisibly saves the edited draft and then approves that exact saved revision before queueing. No success is shown unless the scheduling endpoint confirms a ready worker and persisted job.

For today, **Publish now** requests the next worker opportunity (one minute ahead), never claims that Instagram already published. Published status still requires provider confirmation. Other day-only placements remain drafts until a calendar-wide publication hour/slot is explicitly established; no hour is invented for them. Existing saved publication times are retained. Both publishing capability and the Admin control remain required. This UI release does not apply the controls SQL, enable a worker, or publish content.


### Publishing backend setup, October 19

The reviewed default-off controls SQL was applied to project `pgoxvqziybtasivqiymw` as migration `20261019234206_instagram_operating_controls`; the matching versioned file is now retained under `supabase/migrations/`. Both new tables have RLS and browser-role access remains revoked. The approved account starts with Publishing, Receive and Send false. The queue was empty before setup; no queued job was released.

`vercel.json` now permits the publishing worker at deployment level and adds its one-minute cron, preserving the source-sync cron. This uses existing `CRON_SECRET` automatically through Vercel; no secret value was read or changed. Admin Publishing remains false during verification. A successful authenticated scheduler observation is required before the Admin switch can turn on. Deployment success and a fresh database `worker_seen_at` value are the runtime evidence; source configuration alone is not proof. Messaging deployment flags remain zero, with no webhook credential or subscription changes.


The attempted worker deployment `911b3d1b4d4e626370102d7d68346a0790db2f09` was rejected by Vercel, whose GitHub failure target links to its cron usage/plan limits. No worker deployment or heartbeat was established. The unsupported one-minute entry is therefore removed from active `vercel.json` while its reviewed proposal stays in `docs/instagram-worker-cron.json`; this restores deployability without moving the scheduler or bypassing a restriction. Publishing capability remains deployment-permitted but Admin-off and blocked by the missing authenticated heartbeat. No plan upgrade, new credential or alternate scheduler was authorized. Exact team plan visibility is still unavailable through the denied settings scope.

### Direct owner-requested Publish now

Immediate publishing does **not** require cron or a paid-plan change. POST `/api/content/instagram-publish-now` is available only to the signed-in owner/admin on the same origin, for the exact approved saved post ID/version. It reuses the existing immutable snapshot, unique post-version job, database approval guard, durable unsafe-boundary transitions and existing service-role grants. No new migration, credentials or subscription is introduced. Admin Publishing still starts off and must be deliberately enabled.

The request enqueues/finds only the selected approved job and atomically compare-and-swaps that job's lease/attempt counter; it never drains the general queue. It waits for the approved immediate placement, creates a container once, polls its status and publishes within a bounded foreground request (150-second internal budget, 180-second function limit). Safe status checks may repeat within that single request. There is no publishing timer, cron emulation or automatic browser continuation. Future scheduling separately requires recent authenticated scheduler readiness and stays unavailable here.

HTTP200 Published is returned only for the durable provider-confirmed result. HTTP202 pending/busy/processing means publication is **not confirmed**; the owner can explicitly Continue publishing using the same immutable revision. A creating/publishing/reconciling unknown outcome is never blindly re-created or re-published; confirmation checks use the saved container only. Concurrent identical requests cannot acquire the same lease. Changes to an in-flight post remain blocked by the existing database trigger. Switching Publishing off is rechecked before create/publish operations. The foreground request does not mark a cron heartbeat or enable future scheduling.
