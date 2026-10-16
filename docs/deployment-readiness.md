# Approved Git release

The user approved publishing the tested workspace through the existing Git main → Vercel production workflow. This supersedes earlier offline-only restrictions in historical inspection notes. No credentials or security settings are changed.

## Verified target

- Repository: `https://github.com/daisyman5000/luun-admin`, production branch `main`, root `./`.
- Vercel: `luun-admin-et42`, project `prj_HFSBQu75qPPYvOokMHxl2EuvGEWB`, team `team_7gWEJaTq2aHrlfnqyRaEeUHI`.
- Production: `https://luun-admin-et42.vercel.app`.
- Clean release baseline: `565d24abda0cfcf83e57cd6bb3c4cdc1cdc5a26f`. Original checkout and unrelated inbox edit remain preserved.
- Normal authenticated dashboard verified the mapping. The denied Vercel connector read remains denied; do not retry it.

## Runtime and verification

`vercel.json` supplies nonsecret runtime flags: balances enabled (`LUUN_WISE_REQUESTS_ENABLED=1`), statements disabled (`LUUN_WISE_STATEMENTS_ENABLED=0`), database storage (`LUUN_LOCAL_CONTENT=0`). Existing hosted credentials stay in place. Balances read only profiles and STANDARD/SAVINGS balances; no transfers, statements, credential creation or login. No background network polling; per-runtime cooldown is 60 seconds and is not a distributed account-wide limiter. Missing or failed sources are unavailable, never zero.

The hosted Image Studio explicitly directs users to the existing LUUN Creative Lab Mac app. The local development bridge remains development-only. Production cannot reach laptop loopback or use laptop files as cloud storage.

The approved Supabase migration `20261016160756_operator_workspace.sql` was already applied and verified. Do not reapply it or blindly replay legacy migrations. Shared plan and content writes use authenticated role checks, RLS, version conflicts and audit events. No live business record write was performed by these verification tests.

Clean install: `npm ci`. Checks: `npm run test:operator`, `npm run typecheck -- --incremental false`, `npm run build`. In-memory SQL checks: `LUUN_TEST_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js npm run test:operator-sql`. Do not run sale/checkout scripts against live services.

Acceptance after the exact commit is Ready: authenticated Calendar, Demand & Sales and Customers load; shared plan is readable; brief export downloads without contact details; hosted Studio shows its desktop-only notice; Demand displays actual business and personal balances with currency and retrieval timestamp or an explicit source error; refresh respects cooldown; no statement call occurs. Saving live records and paid model calls require separate scoped execution approval.

No automatic external-agent connector was created. The authenticated brief endpoint exports bounded source context; browser sessions and server credentials must not be copied to agents.
