> Current connection status: Tyson approved the isolated local connection. The existing public URL/key are now configured in a private `.env.local`, local-only storage mode is disabled, and the app is running in database mode. Readiness returns 401 because no local browser session is signed in yet; `/login` returns 200 with the normal enabled form. No business data was written. The remaining step is an existing-account sign-in on the Mac.

# Operator workspace connection — migration applied, app access pending

## Verified target and storage

Tyson supplied project `pgoxvqziybtasivqiymw` (`daisyman5000's Project`, active/healthy, ap-southeast-1, Postgres 17.6.1.141). The verified API URL is `https://pgoxvqziybtasivqiymw.supabase.co`. No staging branch was returned. Treat this as potentially production.

The parent task applied the exact approved SQL at 16:07 UTC on October 16, 2026, then verified RLS, table grants and public-invoker/private-definer function permissions. This task confirmed the read-only migration history entry `operator_workspace`, version `20261016160756`. The local file is now `supabase/migrations/20261016160756_operator_workspace.sql`; its bytes and approved SHA-256 remain `5c647bf00f0386d999e58e3909c998c5388ee554a12ef20961d22b9b8aef628e`. The Library review copy retains the original filename but identical content. See `supabase/operator-workspace-deployment.json`.

**Do not reapply this migration.** The remote list returned only this migration entry; older local app migrations are not reconciled with remote history. Do not run a blanket `supabase db push` or migration repair/replay. No local migration history commands have been used to mutate the remote project.

Verified dependencies: Auth/profile IDs are UUID; profile role is nullable text with owner/admin/logistics/viewer check; profile RLS includes own-profile SELECT and owner/admin management. New policies can read the caller's own role. Null/unknown roles are denied. The migration does not depend on a new or changed `current_user_has_role` helper.

## Exact next approval

Ask: **May I connect only the isolated local app to the confirmed Supabase project using its existing API URL and publishable key, then have you sign in with your existing authorized account?** This enables ongoing session-scoped reads and permitted writes to the new operator records. It does not authorize copying service-role keys, deploying code, importing local drafts, publishing, emails, sale activation, payments or inventory changes.

After approval, retrieve only the project's existing publishable key through the connected Supabase tools, store the URL and key privately in this isolated copy's `.env.local`, disable `LUUN_LOCAL_CONTENT`, and restart the local process without that inherited flag. The new planner does not require `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. No values have been configured by this task.

Then Tyson signs in at `/login` using the existing account; passwords and sessions are not copied from the hosted app. The existing password sign-in flow sends no email. Safe existing deep links are retained, and default sign-in now leads to `/content`.

Check `/api/content/readiness` in that signed-in session. It validates the confirmed project/public-key configuration, authentication, role and read access to the already-applied plan/content tables. It performs no writes. Status is explicitly local, unconfigured, sign-in required, or database ready; it never prints keys or credentials. No sample data or local fallback is used in database mode.

## What becomes usable after that step

Content packages, the shared plan, dated commitments and work-plan reads can use real database persistence under session RLS. Customers can read its existing conversation records and shared business context with the same signed-in client. The shared plan is also included in the existing agent snapshot, and Demand displays promotion guidance without changing calculations.

The legacy Demand/sale/Wise backend still needs its existing server-side configuration for those integrations. Configuring only the public-key/session path does not silently supply that access. It must not be replaced with copied production service-role credentials. The hosted Vercel app is unchanged until a separately authorized, source-verified deployment.

Creative Lab media remains explicitly development/loopback-only; private files stay on the Mac. A database draft may retain a source reference, but a Mac-only reference cannot be approved for database publication planning until a separately authorized private media-storage bridge exists. No Instagram connection or publishing worker has been activated.

## Security and tests

Session reads use existing Supabase clients/RLS. Only authenticated, profile-authorized callers can invoke public SECURITY INVOKER wrappers; private SECURITY DEFINER implementations independently verify identity/roles, lock versions, enforce review/publication evidence and write audit history. Direct authenticated table mutations and anonymous access are revoked. Audit reads are owner/admin-only. Existing authentication, orders, sale mutations and send behavior are preserved.

Application tests cover local persistence, public-key readiness, redirect safety, roles, media traversal/symlinks, cross-site requests, conflict handling, shared-plan review and context availability. SQL tests execute only in ephemeral in-memory Postgres with synthetic Auth/profile fixtures. `npm run test:planning` runs the focused suite. `npm run test:operator-sql` uses the temporary PGlite test dependency via `LUUN_TEST_PGLITE_MODULE`; it does not contact Supabase or reapply the remote migration.
