# Hosted Video creator: release checkpoint

Prepared locally on `codex/content-video-current`, based on production/main `6ede52adad6c10ec55caab023ce1da1816737154`. Not deployed. Existing Image Studio, calendar, publishing, customer and Sales components are unchanged.

## Implemented workflow

Idea → Claude script → editable script approval → owner uploads real audio narration → Generate. Generate reads only the two selected Drive roots, extracts actual candidate frames, transcribes the owner recording for word timing, asks Claude for structured cuts/layouts, validates exact approved spoken-word coverage and source references, and exports an MP4 in the browser. No automatic publication, generated imagery, voice or presenter. The previous separate storyboard approval is superseded by this workflow.

Private Supabase storage keeps original recording bytes, a derived 48 kHz mono WAV, preview JPEGs and finished MP4 separately. Original recording is never overwritten. Claude gets the approved script, word timings and up to 12 selected JPEGs; OpenAI gets only derived owner audio; Drive sources are read through authenticated bounded range requests. No raw Drive credentials reach the browser. Edit JSON accepts fixed layout/motion enums, never executable model code.

## One setup batch — no secret values in chat

Supported destinations: existing Luun Admin Vercel project → Settings → Environment Variables, with secrets server-only and scoped to the intended environment; for local testing, ignored `.env.local` in this worktree. Never put these in `NEXT_PUBLIC_*`, source control, screenshots or chat. Use the platform's private entry controls. Existing credentials may be reused only through an already authorized reference/secure entry mechanism; do not copy the separate prototype's secret file into the repository.

| Requirement | Server environment names | Current evidence |
| --- | --- | --- |
| Claude Messages + vision access; select a currently available vision/tool-capable model | `ANTHROPIC_API_KEY`, `LUUN_VIDEO_CLAUDE_MODEL` | Empty in inspected local config. Production unknown: environment read returned 403. No account/key creation performed. |
| OpenAI transcription access for `whisper-1` word timestamps | `OPENAI_API_KEY` | Existing separate local credential reference `LUUN_VIDEO_OPENAI_CREDENTIALS` was previously found; this hosted adapter reads the existing runtime `OPENAI_API_KEY`, not a filesystem reference. Production availability unverified. No new OpenAI account/key planned. |
| Existing Google OAuth client and refresh token authorized for readonly Drive | `LUUN_VIDEO_DRIVE_CLIENT_ID`, `LUUN_VIDEO_DRIVE_CLIENT_SECRET`, `LUUN_VIDEO_DRIVE_REFRESH_TOKEN` | Empty locally; production unknown. Alternatively an already-authorized short-lived `LUUN_VIDEO_DRIVE_ACCESS_TOKEN` supports bounded testing, not durable unattended operation. |
| Explicit connection/spend switches, only after approval | `LUUN_VIDEO_DRIVE_ENABLED=true`, `LUUN_VIDEO_PAID_ENABLED=true`, `LUUN_VIDEO_APPROVED_OPERATIONS=script,transcription,edit,drive-read` | Remain OFF/unapproved. No paid calls performed. |

Google Drive plugin access is a connector-managed connection, not credentials available to a hosted Vercel application. No supported credential-export/reuse mechanism has been established. Do not assume plugin access authorizes extracting tokens. If no existing suitable OAuth client/refresh token exists, creating that client and authorizing `https://www.googleapis.com/auth/drive.readonly` need explicit owner approval at that action. This scope can read accessible Drive files; application code separately pins reads to roots `1F2nbfjgcHIZVL5Sy5GZSfjQ9xjxR7sx8` and `1j6iBiJ5V0wgY4gAVQ7ZYzSPtry3aYwao`. It excludes obvious swipe/reference-only filenames but folder ownership/rights still must be accurate.

## Small hosted prerequisites (drafts, not applied)

Apply reviewed `creator-transfer-budget.sql`: two counters and two service-role-only atomic functions on the existing private Video project table. A generation gets at most 500 MiB of source transfer; the same generation key cannot reset the allowance. The audio-only workflow needs no MOV upload allowance or bucket permission change. No new bucket, public object access, broad storage policy, account or paid rendering service is needed. The existing server owner/admin + same-origin checks remain required.

## Test approval and costs

No spend has been authorized. Request-count bounds (8 reserved provider requests per project; one script request, one transcription plus one edit request per Generate) are **not a dollar cap**. Before live testing: verify selected Claude model and OpenAI pricing/account limits, agree one bounded test and its maximum spend; configure a genuine provider-side monetary limit if a hard dollar ceiling is required. No subscription purchase is part of this release. Usage may incur Claude/OpenAI charges and existing Vercel/Supabase transfer/storage costs; browser rendering itself uses the owner's device, no purchased renderer.

The previous browser upload to `https://luun-admin-et42.vercel.app` of `/tmp/luun-audio-upload-check/idea.m4a` was cancelled before execution. Do not retry it, or substitute an HTTP upload, without specific renewed authorization. For a live end-to-end test request approval for one clearly test-owned recording and owned media frames to private Luun Video storage, plus the separately described provider transmissions and budget. Mark/hide the test project recoverably afterward; do not delete source media.

## Limits and readiness

Browser export uses timestamped AVC/AAC WebCodecs via Mediabunny and trusted GSAP templates at 720×1280/24fps. Tested on the connected Chrome browser; not a Mac FFmpeg daemon and not a Vercel FFmpeg claim. The browser/device must stay open during frame selection and export. Unsupported codecs fail explicitly before upload/render; 100 MiB recording/output, 120 seconds, 25 MiB audio/image decode, 40 MP image, 24 ranked candidates, up to six usable source files/12 frames, 200-file/20-folder/two-level catalogue bounds. Coverage/skips are saved internally; missing usable footage errors before any paid edit. Large Drive videos can be range-read up to 16 GiB source size without downloading the whole original. Some codecs/range layouts may exceed the transfer budget and fail honestly.

Script/recording changes invalidate prior edits/exports. Strict transcript matching rejects changed spoken claims rather than rewriting approved words. Finished edits are resumable without new provider calls. In-flight/uncertain provider requests block retry pending inspection; there is no automatic paid retry. Fixtures verify adapter contracts, not live provider quality, Drive account permissions or authenticated production upload/reload.

## Initial 913d15c verification (historical)

- `npm run test:video`: 31 passed (12 new creator contracts, eight hosted persistence/legacy contracts, 11 local/image invariance contracts). Legacy two-gate fixture tests intentionally describe the preserved historical engine, not the new UI.
- `npm run test:content`: six passed; `npm run test:instagram`: 187 passed. Total 224.
- `npx tsc --noEmit`, targeted ESLint on changed TypeScript/TSX and `npm run build`: passed. Broad repository ESLint also scans generated alternate Next build output and existing CommonJS tests and reports errors; no unrelated lint fixes made.
- Actual Chrome fixture render: 574,862-byte MP4, 720×1280 H.264, 48 kHz mono AAC. Planned cuts total 3.6 seconds; encoded container 3.67 seconds including AAC/frame padding. Original test sources unchanged. Actual output/frame copied to `../outputs/creator-checkpoint/FIXTURE-browser-*`; never uploaded to production or listed as an owner's real project.
- Local Video minimal list loads on isolated port 4338. Calendar UI loads unchanged. Image Studio component is byte-identical to production; local image service is unavailable, so no image generation was exercised. Existing port 4335 showed a Next render error during inspection; it was not used as evidence of the hosted flow or repaired by killing an unverified process.
- Fresh read-only remote main check remains `6ede52adad6c10ec55caab023ce1da1816737154`. No deployment, migration, OAuth grant, new credential or paid provider call performed in this checkpoint.


## Review hardening checkpoint — 2026-10-21

The seven review findings have code fixes pending independent re-review:

1. Cuts must contain full spoken-word intervals plus 20 ms outward padding. Truncated 10 ms reproductions fail.
2. Missing/expired decoded source or required speaker samples fail export; sample generators close on failure. Both browser and server inspect actual MP4 frame/sample counts, timing, sample byte sizes and duration against the cut plan, not just track headers.
3. Every logical provider operation is persisted before invocation and its result immediately afterward. Completed transcription is reused after an edit failure. After a six-minute lease, interrupted jobs reconcile to explicit failed/uncertain states. Uncertain operations and legacy pending requests block replay; no automatic paid retry. Reconciliation happens on the next action, not a new background worker.
4. Owner video/WAV use stable same-origin authenticated range endpoints; the server obtains a fresh private storage URL for each bounded read and never redirects the decoder to an expiring token. Unit tests advance beyond 60 seconds and read beyond a 32 MiB cache boundary.
5. Before Generate's paid calls, probe exact 720×1280/24fps AVC and 48 kHz mono AAC configurations, owner decoding at distributed times and actual candidate decoding. Real mobile hardware remains unverified; unsupported AAC was simulated and correctly rejected in browser before generation.
6. Excluded folder names block traversal; ancestor checks reject pinned files moved into Swipes/Competitor/Reference-only folders.
7. Up to 24 ranked candidates replenish failed decodes. Up to four distributed offsets are attempted per file, retaining two usable frames from up to six files, at most 12 frames total. Decode failures and coverage are saved internally; no usable frames stops before paid generation.

### Verified cost envelope (still OFF)

Official sources checked 2026-10-21: https://platform.claude.com/docs/en/models/sonnet-4-6/overview ($3/MTok input, $15/MTok output); https://developers.openai.com/api/docs/models/whisper-1 ($0.006/minute). Current Sonnet 5.5 rejects forced tool selection: https://platform.claude.com/docs/en/models/sonnet-5-5/overview. This adapter therefore fails closed for models other than explicitly configured `claude-sonnet-4-6`; there is no implicit model default. Account availability is checked via Models API before a paid request. A future model needs a reviewed contract/rate profile, not a guessed ID.

`creatorCostQuote` requires one exact `LUUN_VIDEO_TEST_PROJECT_ID` and an explicitly approved `LUUN_VIDEO_PROVIDER_BUDGET_USD` greater than zero and at most 2. No values were configured. Script reserves USD 0.24; Generate reserves USD 0.56. Reservations persist in the same project CAS write as the generation key and never refund failed/uncertain work. Unpriced legacy operations block use of an allowance. New project IDs cannot use this test authorization. One full script + Generate reserves USD 0.80.

Bounds: 32,000 script input tokens/1,400 output; 64,000 edit input/5,000 output; text/tool/schema UTF-8 byte limits of 12,000/22,000; 12 JPEGs with each side at most 640; verified canonical PCM audio at most 120 seconds. Free Claude token-count preflight rejects larger prompts before Messages creation. Thinking is disabled; no server tools, caching writes, fast mode or regional pricing modifiers are requested. Quote uses twice maximum standard-price usage, rounded upward to whole cents. Static rate verification expires after seven days and must be reviewed again.

This is an app-level conservative provider-usage allowance, not an account-wide billing guarantee: unrelated key usage, taxes, provider pricing changes and account billing controls remain outside it. No provider-side monetary limit was created or verified. No paid calls were made.

### Minimal secure setup sequence

1. Privately check existing Vercel `OPENAI_API_KEY` availability rather than requesting a replacement. The approved existing local reference can now be used by local code through `LUUN_VIDEO_OPENAI_CREDENTIALS`: explicit absolute path only, owner-owned/private regular file, no symlinks, no copying, no permission changes. This fallback is refused in production/Vercel; cloud still needs its existing runtime secret. No real credential file was read by these new tests; only synthetic fixture files.
2. In Vercel's private environment editor enter only missing Claude key/model and existing suitable Drive OAuth credentials. Plugin-managed Drive tokens cannot be extracted/reused. New OAuth client/scope or key creation still requires specific approval. Keep paid/Drive enable switches OFF while checking prerequisites.
3. Review/apply the existing transfer-budget schema draft separately. The previously proposed MOV allowance is no longer needed; no bucket change should be applied.
4. Identify one test project privately; only after a bounded spend approval set its project ID and allowance server-side. Agent can set nonsecret flags/IDs after authorization; owner need not paste a list of variables or any secrets into chat.
5. Obtain renewed approval for the previously cancelled production test upload and provider transmissions, then enable only the approved operations for that one test. No upload retry or paid call has happened.

### Evidence so far

- 41 Video tests passed, including cost reservation, actual WAV duration, safe credential reference, stale job reconciliation/transcription reuse, short-word boundaries, excluded ancestors, failed candidate replenishment, renewed private range reads and missing MP4 sample bytes. Content/Instagram suites previously passed 6/187; latest full rerun/build status is reported in the task checkpoint.
- Browser: missing chosen footage and missing speaker frames rejected; unsupported AAC configuration rejected. A real 76-second export from a 49,888,262-byte synthetic recording (larger than the 32 MiB decoder cache) produced 1,824 video frames, exactly 76 video seconds, 76.0747 audio seconds including AAC padding, and a 19,284,751-byte MP4; FFmpeg decoding exited 0 without warnings. This remains fixture evidence, not live Claude/Drive validation. A repeat using 4 MiB fixture range responses subsequently passed: 25 requests, maximum 4,194,304 bytes, 94,448,670 bytes total, farthest offset 49,888,261.
- Rendering remains browser-only with the tab/device open. Real mobile device verification, live account access, authenticated production upload/reload and full live workflow remain outstanding. No release, credential setup, OAuth change, migration, new service purchase or paid call was performed.


## Audio-only + final focused-review checkpoint

Latest owner scope: script approval → audio narration upload → Generate → existing Drive footage, captions and animation. New uploads accept audio only (25 MiB); paid Generate rejects a speaker-video recording. New Claude plans allow only B-roll/concept layouts and explicitly prohibit a talking head. Existing archived video records/exports are preserved, including their legacy rendering support. No MOV bucket allowance is needed.

The two follow-up review defects are fixed in code: provider invocation and persistence have separate error handling; a successful result is checkpointed with storage-only retries and read-after-write reconciliation. If confirmation remains unavailable, the operation/job stays pending or uncertain and a new job cannot dispatch it again. Failure injection covers transient pre-write failure, a committed write with lost response and persistent checkpoint failure. Cut padding now uses up to 20 ms of available silence, splitting small gaps at their midpoint; 30-second continuous transcripts with zero and 10 ms gaps validate without truncating words.

Current Video suite: 46 passed. Content/Instagram suites passed 6/187; TypeScript, targeted lint and the audio-only production build pass. Long capped-range browser export passed; a narrow 390×844 viewport also exported successfully. Viewport was reset afterward. This is desktop Chrome emulation, not physical mobile codec verification.

A separate script-generator Debug tab is newly requested and not implemented in this checkpoint. Current generator has no brand-guide/product-facts retrieval; it uses the owner's idea, previous script, length and optional API revision feedback with fixed anti-invention instructions. Debug must expose sourced context honestly and save candidates without overwriting approved scripts.
