# Hosted Content Video integration

Scope: additive Video tab only. Current base main/production `3fcbbcb`; Image Studio branch, creative components, navigation, calendar/publishing and customers are unchanged. No localhost iframe or Mac filesystem is used by hosted requests. No paid AI/avatar services are enabled.

## Applied private persistence

Existing Supabase project `pgoxvqziybtasivqiymw`, migration `20261020234933_content_video_private_persistence` applied and verified. The SQL snapshot in this directory is evidence; do not reapply it or run a blanket database push.

- New `content_video_projects` and `content_video_media` tables, both RLS enabled.
- Existing owner/admin roles only. No anonymous table access; authenticated writes denied. Existing server credential writes only after verified session/profile checks in the Video route.
- New private `content-video` bucket with 100 MiB per-object ceiling; audio intake 25 MiB, preview 2 MiB. Existing `instagram-media` bucket remains private/JPEG-only/8 MiB unchanged.
- Path-specific non-upsert signed upload tokens; no service credential in client code. Read URLs expire in 60 seconds. Hash/size/container checks precede attachment. Project writes use expected revision/CAS.
- No existing records, image bucket settings, users, auth configuration or credentials changed. Security advisor reported no new Video findings; existing unrelated notices were left untouched.

## Runtime

Voice and selected owned media transfer directly to private storage using the existing Supabase client. Small metadata requests go through the authenticated Next route; large files do not pass through Vercel's 4.5 MB function body cap. Optional final narration is separate from the idea note.

Scripts/storyboards remain assistant-prepared, with separate approvals. Server validation binds exact script, captions, media hashes, actual preview frame references and narration. Missing/changed assets block approval/render. Concurrent/stale edits are rejected. Handoff keys reject changed payloads; rendered outputs bind the approved board and request key.

The browser renderer uses canvas, MediaRecorder MP4 encoding and optional Web Audio narration; it needs a supported current browser and a visible tab during rendering. It does not require a server FFmpeg executable, background Mac service or a new paid renderer. It rejects unsupported MP4 encoding rather than relabeling WebM. MP4 bytes are hash-checked into private storage and persisted against the approved snapshot.

This is a bounded rough-cut renderer, not frame-exact professional transcoding: actual frame delivery follows browser scheduling. Browser rendering cannot continue after the tab is closed. The approved edit remains saved for retry. No publishing is added.

## Verification evidence and boundaries

- Eight mocked hosted persistence/approval contract tests plus eleven actual local video/audio tests passed (19 total).
- Existing Instagram suite: 187 tests. Existing Content suite: 6 tests. Total 212.
- Browser renderer fixture produced a real 720×1280 H.264 MP4. Narration and video-clip checks are recorded in the task evidence.
- Production upload/reload/approval/render verification is required after deployment before declaring the hosted flow working.

Automatic ASR/script drafting is not enabled. Existing OpenAI transcription and selected-root Drive ingestion adapters remain in the separate prototype and are not connected to this hosted path. No new OAuth, Drive download, AI call or generated presenter is authorized by this deployment.
