# Script-only picker

Content → Video now opens Scripts. Optional text or the existing private voice recorder feeds five ideas. Choose an idea, generate dialogue, refine and approve. The existing OWNER_SCRIPT_PROMPT is unchanged. No rendering, Drive execution, publishing or new provider is invoked.

Sourcing is a curated public source pack in lib/content-scripts.ts, explicitly labeled in the UI; it is not a search crawler or live discovery. Product facts come from Luun's designer page. The Ohio State research summary supports a qualified leisure observation only; it is not evidence that furniture treats a condition. Returned source IDs must resolve to the pack. Semantic factual accuracy still requires owner review.

One private batch per owner/admin and UTC day uses a deterministic project UUID. Repeat generation returns the saved batch. Provider operation checkpoints, CAS, cost reservations and uncertain-call replay protection use existing tested code. Selected-idea drafts and approved versions survive selection changes in the stored history. No background scheduler or notifications were created.

## Configuration boundary

No credentials or spending flags were changed. The old Video/Drive compiled release lock remains false. Only this script route selects the script adapter path; its existing runtime authorization still requires all of:
- existing OPENAI_API_KEY (local development may use the existing owner-private LUUN_VIDEO_OPENAI_CREDENTIALS reference; it is not copied to hosting);
- LUUN_VIDEO_PAID_ENABLED=true;
- LUUN_VIDEO_APPROVED_OPERATIONS including script, plus idea-transcription for optional audio;
- LUUN_VIDEO_SCRIPT_MODEL=gpt-5.4-mini-2026-03-17;
- LUUN_VIDEO_TEST_PROJECT_ID equal to the authenticated daily batch ID;
- LUUN_VIDEO_PROVIDER_BUDGET_USD: explicitly approved, positive and at most USD2.

These inherited test safeguards intentionally do NOT grant an ongoing daily allowance. An owner-approved recurring script budget and implementation replacing the project-specific test restriction are needed before unattended/daily paid use. Do not configure these from this document without approval. GET /api/content/scripts returns only nonsecret readiness and daily project ID. Price verification expires after seven days; no unverified model fallback occurs. Current quote reserves USD0.10 per script/idea request and USD0.03 per ≤120s transcription, cumulatively under the project allowance. These are conservative reservations, not a subscription or promise of provider invoice totals.

Production credential and allowance status must be observed after deployment; local missing flags do not prove production missing flags. Local parent .env.local contains the existing OpenAI reference, but this isolated app has no .env.local and no enabled allowance. No real paid validation was performed.

The existing recorder supports long recordings and retains/uploads them. This transcription adapter accepts verified canonical WAV ≤120s only. Longer recordings remain saved and return an explicit preparation error, never silently truncate or charge. Long-audio transcription segmentation is not implemented here.

## Offline evidence

8 script tests exercise actual route state transitions with injected provider/store fixtures, five-result/source validation, preserved prompt, explicit choice, refinement/approval/history, daily duplicate prevention and uncertain-call replay protection. 74 existing Video/recorder tests,199 Instagram/calendar regressions,6 popup image tests pass. TypeScript, targeted ESLint and production build pass. A separate browser fixture exercised five cards→choose→script→approve; fixture outputs were not real OpenAI results and did not write production records.

Forecast base2fa0cfd is preserved; Calendar, Image Studio branches and finance files are unchanged by this release. Existing prompt and recorder files are unchanged.

## October22 explicitly approved text test

The owner approved USD0.50 TOTAL text-only OpenAI use. `content-scripts-test-allowance.ts` encodes that one authorization: sole owner actor, project ab788bd2-47b8-47a5-a1f6-86cf4c299cf4, supported pinned model, expiry2026-10-23T00:00:00Z. The script route can use this grant without adding prototype environment flags. It does not configure or retrieve Vercel settings, copy credentials, grant external access or change old Video/Drive release locks. Existing OPENAI_API_KEY is reused through the established credential resolver. Explicit existing paid-disable, operation exclusion, conflicting model/project or zero budget still blocks it. A smaller existing budget wins; larger never exceeds USD0.50.

Each job reserves conservatively USD0.10 before dispatch through CAS; aggregate budget never resets, failed requests retain reservations, pending/uncertain operations block replay. At most five text jobs fit this one project. The new grant is not passed to transcription or editing adapters, and the provider also rejects those stages if accidentally passed a grant. Authorization is revalidated immediately before the paid response dispatch. No recurring daily authorization exists. Tests exercise expiry, other actors/projects, explicit overrides, lower budgets and five-reservation exhaustion.
