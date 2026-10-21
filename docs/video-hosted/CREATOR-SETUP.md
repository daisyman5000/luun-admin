# Hosted Video creator: release checkpoint

Prepared locally on `codex/content-video-current`, based on production/main `6ede52adad6c10ec55caab023ce1da1816737154`. Not deployed. Existing Image Studio, calendar, publishing, customer and Sales components are unchanged.

## Implemented workflow

Idea → Claude script → editable script approval → owner uploads a real audio/video recording → Generate. Generate reads only the two selected Drive roots, extracts actual candidate frames, transcribes the owner recording for word timing, asks Claude for structured cuts/layouts, validates exact approved spoken-word coverage and source references, and exports an MP4 in the browser. No automatic publication, generated imagery, voice or presenter. The previous separate storyboard approval is superseded by this workflow.

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

Apply reviewed `creator-transfer-budget.sql`: two counters and two service-role-only atomic functions on the existing private Video project table. A generation gets at most 500 MiB of source transfer; the same generation key cannot reset the allowance. Add `video/quicktime` to the existing private `content-video` bucket's allowed MIME types for MOV uploads, retaining its 100 MiB limit and existing private/RLS policies. No new bucket, public object access, broad storage policy, account or paid rendering service is needed. The existing server owner/admin + same-origin checks remain required.

## Test approval and costs

No spend has been authorized. Request-count bounds (8 reserved provider requests per project; one script request, one transcription plus one edit request per Generate) are **not a dollar cap**. Before live testing: verify selected Claude model and OpenAI pricing/account limits, agree one bounded test and its maximum spend; configure a genuine provider-side monetary limit if a hard dollar ceiling is required. No subscription purchase is part of this release. Usage may incur Claude/OpenAI charges and existing Vercel/Supabase transfer/storage costs; browser rendering itself uses the owner's device, no purchased renderer.

The previous browser upload to `https://luun-admin-et42.vercel.app` of `/tmp/luun-audio-upload-check/idea.m4a` was cancelled before execution. Do not retry it, or substitute an HTTP upload, without specific renewed authorization. For a live end-to-end test request approval for one clearly test-owned recording and owned media frames to private Luun Video storage, plus the separately described provider transmissions and budget. Mark/hide the test project recoverably afterward; do not delete source media.

## Limits and readiness

Browser export uses timestamped AVC/AAC WebCodecs via Mediabunny and trusted GSAP templates at 720×1280/24fps. Tested on the connected Chrome browser; not a Mac FFmpeg daemon and not a Vercel FFmpeg claim. The browser/device must stay open during frame selection and export. Unsupported codecs fail explicitly before upload/render; 100 MiB recording/output, 120 seconds, 25 MiB audio/image decode, 40 MP image, six ranked source files/12 frames, 200-file/20-folder/two-level catalogue bounds. Coverage/skips are saved internally; missing usable footage errors before any paid edit. Large Drive videos can be range-read up to 16 GiB source size without downloading the whole original. Some codecs/range layouts may exceed the transfer budget and fail honestly.

Script/recording changes invalidate prior edits/exports. Strict transcript matching rejects changed spoken claims rather than rewriting approved words. Finished edits are resumable without new provider calls. In-flight/uncertain provider requests block retry pending inspection; there is no automatic paid retry. Fixtures verify adapter contracts, not live provider quality, Drive account permissions or authenticated production upload/reload.

## Verification at this checkpoint

- `npm run test:video`: 31 passed (12 new creator contracts, eight hosted persistence/legacy contracts, 11 local/image invariance contracts). Legacy two-gate fixture tests intentionally describe the preserved historical engine, not the new UI.
- `npm run test:content`: six passed; `npm run test:instagram`: 187 passed. Total 224.
- `npx tsc --noEmit`, targeted ESLint on changed TypeScript/TSX and `npm run build`: passed. Broad repository ESLint also scans generated alternate Next build output and existing CommonJS tests and reports errors; no unrelated lint fixes made.
- Actual Chrome fixture render: 574,862-byte MP4, 720×1280 H.264, 48 kHz mono AAC. Planned cuts total 3.6 seconds; encoded container 3.67 seconds including AAC/frame padding. Original test sources unchanged. Actual output/frame copied to `../outputs/creator-checkpoint/FIXTURE-browser-*`; never uploaded to production or listed as an owner's real project.
- Local Video minimal list loads on isolated port 4338. Calendar UI loads unchanged. Image Studio component is byte-identical to production; local image service is unavailable, so no image generation was exercised. Existing port 4335 showed a Next render error during inspection; it was not used as evidence of the hosted flow or repaired by killing an unverified process.
- Fresh read-only remote main check remains `6ede52adad6c10ec55caab023ce1da1816737154`. No deployment, migration, OAuth grant, new credential or paid provider call performed in this checkpoint.
