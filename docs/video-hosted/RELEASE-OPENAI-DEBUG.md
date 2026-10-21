# Current release: audio narration + OpenAI Script Debug

This supersedes historical Claude-script and talking-head setup notes. OpenAI writes scripts; Claude directs the edit only. Images, calendar, publishing and all unrelated admin components are unchanged.

Video → Create: idea, script approval, audio narration upload, Generate, MP4. Video → Debug: owner-editable writing instructions, separately labelled brand/product sources, explicit unknowns, target duration, safe resolved OpenAI request, saved instruction versions, four saved draft candidates, prior-output comparison and explicit Apply. Missing brand/product context stays empty and unknown; no product claims or brand guide were inferred from model memory or unrelated customer data. Source labels are supplied by the owner, not independent verification. Recognizable credentials, links, email addresses and local paths are omitted from prompt snapshots. No credentials/headers are exposed.

Normal generation and Debug reruns call the same OpenAI Responses adapter, using strict JSON schema, `store:false`, standard service tier, no reasoning, 1,400 maximum output tokens and a 32,000 input-token ceiling. Supported pinned script model: `gpt-5.4-mini-2026-03-17`. Official contract/pricing checked 2026-10-21: https://developers.openai.com/api/docs/models/gpt-5.4-mini and https://developers.openai.com/api/docs/guides/structured-outputs. Input counting: https://developers.openai.com/api/docs/guides/token-counting.

Each request identity includes the actual safe request, provider/model and request key. Reruns preserve the working script, approval, narration and export; Apply clears approval and derived edit/output references. Original source/media bytes are retained. Saved instructions do not change an approved script. CAS writes, durable operation results and uncertain-result replay protection apply to Debug exactly as to normal generation.

## Release is disabled for remote operations

`CREATOR_REMOTE_OPERATIONS_ENABLED=false` is checked in for this release. Production environment flags cannot enable paid provider calls or Drive reads through the default server path. Tests use explicit injected fixture dependencies, never live calls. Preview, instruction saving and draft inspection work without provider calls. Enabling remote operations requires a separate reviewed code/setup/test approval. No credentials, OAuth permissions, database migration or bucket policy changes are part of this deployment.

## Minimal setup after approval

Use existing Luun Admin Vercel project → Settings → Environment Variables with private server-only entries; never chat or `NEXT_PUBLIC_*`.

1. Reuse existing `OPENAI_API_KEY` if available; set nonsecret `LUUN_VIDEO_SCRIPT_MODEL=gpt-5.4-mini-2026-03-17`. Script generation no longer requires Claude. Local-only existing `LUUN_VIDEO_OPENAI_CREDENTIALS` references remain supported without copying secrets; refused on Vercel.
2. For editing, existing authorized Claude key/model: `ANTHROPIC_API_KEY`, `LUUN_VIDEO_CLAUDE_MODEL=claude-sonnet-4-6`. OpenAI `whisper-1` provides narration word timings.
3. For the selected Drive roots, reuse an existing suitable read-only OAuth connection via `LUUN_VIDEO_DRIVE_CLIENT_ID`, `LUUN_VIDEO_DRIVE_CLIENT_SECRET`, `LUUN_VIDEO_DRIVE_REFRESH_TOKEN`. Plugin-managed credentials cannot be extracted or assumed usable by Vercel. A new OAuth client or `drive.readonly` grant requires separate approval. No folder crawling beyond the bounded selected roots.
4. Review/apply the existing atomic transfer-budget schema draft before enabling Drive. No MOV bucket allowance is needed for audio-only narration.
5. Approve one identified test project and provider-usage allowance ≤USD 2, then configure `LUUN_VIDEO_TEST_PROJECT_ID`, `LUUN_VIDEO_PROVIDER_BUDGET_USD` and the already documented operation switches only after the release lock is deliberately reviewed. OpenAI script reservation is USD 0.07; Generate remains USD 0.56 (2× published maximum-request usage, rounded up). Reservations are never automatically refunded; price verification expires after seven days. This is app usage control, not an account-wide billing/tax guarantee.

Local inspected configuration lacks Claude/Drive values and has a separate OpenAI reference. Production configuration remains unverified because Vercel project/environment API access returned 403; no secret reads or reconnection attempted. The compiled release lock independently establishes disabled execution.

Required live-test permission: one owner-selected ≤30-second test narration and selected owned Drive JPEG frames to private Luun storage; idea, instructions, labelled context and prior script to OpenAI for writing; derived WAV to OpenAI for transcription; approved script, word timings and ≤12 selected JPEGs to Claude for editing. No paid test or media transmission has been authorized. The previously cancelled production browser upload was not retried or replaced with HTTP upload.

Rendering stays in the user's browser with the tab/device open, using trusted GSAP templates and WebCodecs/Mediabunny, not a cloud background renderer. Desktop Chrome 76-second capped-range output and narrow viewport emulation passed; physical mobile encoding remains untested. Fixture results are not live provider/Drive validation.
