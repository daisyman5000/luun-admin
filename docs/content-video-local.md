# Content: additive local Video tab

Local-only implementation on branch `codex/content-video-current`, based on current production/main `3fcbbcb`. `app/content/page.tsx` adds the Video link and separate view. The shared layout is unchanged from current production/main, which already has no shared business plan or operator work/agent brief mounts. Its Image Studio link and rendering branch are unchanged byte-for-byte. Calendar components, image generation/assets, publishing, database schema and access controls are unchanged. Concurrent edits in the original checkout were not copied or overwritten.

## Run and owner flow

Use the existing dependency installation. Start this isolated checkout with:

```sh
LUUN_LOCAL_CONTENT=1 LUUN_LOCAL_VIDEO=1 \
LUUN_STORYBOARD_ENGINE_ROOT=/Users/tysonwalker/Documents/Codex/2026-10-20/task-2 \
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 4335
```

Open `http://127.0.0.1:4335/content?view=video`. Do not supply hosted database or provider credentials. The native Content page invokes its own same-origin API and a local subprocess; it does not embed or depend on the Creative Lab HTTP server. The existing validated engine and media library must remain installed at the configured absolute path. This is a local integration dependency, not a standalone hosted package.

Select New video, give an idea or record/upload an idea note, and tell the assistant the project ID. The assistant prepares a script handoff in conversation. Approve or revise the script, then review actual selected frames, provenance, captions and missing assets. Approve or revise the storyboard. A deterministic local render produces a downloadable MP4. A final narration file is optional and must be explicitly confirmed; idea notes are not silently reused as narration. Without final narration the output is an explicitly labeled silent captioned rough cut. There is no automatic transcription, provider writing, generated presenter or publishing in this mode.

Projects, approval hashes, media proxies and exports persist in ignored `.local-content/video/`. Assistant handoffs use `POST /api/content/video` with `action: handoff`, project ID, expected revision, idempotency key and validated script/storyboard artifact. `GET /api/content/video?context=ID` provides bounded real frame candidates and coverage for the assistant. Owners do not author edit JSON. Script revisions invalidate both approvals and exports. Narration, shot or caption changes invalidate storyboard approval. Missing assets, changed sources and mismatching approvals block rendering. Previously approved wording and shots are not silently replaced.

The API requires development mode, both local flags, loopback Host, and same-origin request checks. Production and remote requests fail closed. The child process does not inherit provider/database secrets and explicitly disables live generation, Drive imports, fixture mode and approved paid operations. This implementation has no cloud mutation or provider request path.

## Verification

- `node --test tests/content-video.test.cjs`: six integration/security tests, including a real 15-second silent MP4, selected real frame, both gates, revision invalidation, replay, production/cross-origin denial, credential isolation and safe download paths.
- Existing `npm run test:content`: six passing tests. Current `npm run test:instagram`: 187 passing tests, including calendar, composer, publishing, inbox, controls and results regression coverage. Total: 199 tests.
- TypeScript, scoped ESLint and `LUUN_VERIFY_BUILD=1 npm run build`: passed.
- Native browser verification uses an explicitly labeled integration project, not owner-approved advertising. Calendar and Video views were browser-verified. Image Studio renders its unchanged connection-unavailable state because the installed desktop service is unavailable; no generation was attempted. Image Studio/creative components and all other existing files except the additive Content navigation change match current main exactly. Microphone capture and a real owner narration upload have not been exercised; provider/Drive/hosted flows were not exercised.

## Production requirements — proposal only, not implemented or authorized

Read-only source inspection found `operator_content_posts` with one post-level approval and role-checked audited RPCs. It does not model the independent script and storyboard approvals, source fingerprints or resumable render state. The current publishing work references a private `instagram-media` JPEG-only bucket with an 8 MiB image bound. That image bucket/workflow should remain untouched. These observations come from local source, not live schema/storage inspection.

The smallest separate production change would need:

1. Private video project records with revision checking, frozen script/storyboard hashes, render request idempotency and atomic role-checked transitions/audit. Existing owner/admin approval roles should carry over; draft editing and viewing need explicit agreed role policy.
2. A separate private video media location for selected source copies, actual preview frames, optional audio and final MP4s. Preserve originals and record source IDs/versions/hashes and usable rights. Authenticated reads or short-lived signed URLs, per-project access checks, bounded sizes, retention and deletion policy are required. Do not make the existing image bucket public or place a service-role key in the browser.
3. An authenticated rendering worker with durable job state and private storage access. This local FFmpeg subprocess and Mac filesystem do not run on Vercel. Vercel request filesystems are not the durable project/media store. A locally connected worker or separately approved rendering runtime needs a concrete security/availability design before hosted rendering is enabled.

Separate approval is needed for the exact schema/migrations, private media uploads/storage and retention/costs, worker credentials/runtime, production integration and deployment. None were performed. No provider connection or paid generation is needed for the current silent rough-cut path. Transcription/presenter automation remains paused. No calendar scheduling or Instagram video publishing is added.

Reference: [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control), [private downloads](https://supabase.com/docs/guides/storage/serving/downloads), [database RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
