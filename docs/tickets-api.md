# Minimal Luun Tickets API

Uses the existing Webflow intake, job_tickets table and GROK_BOT_SECRET. No Gmail connection, outbound-email handler, new bot key or approval workflow. Webflow inquiries appear automatically. The existing /ticketing link now says Tickets.

Apply supabase/migrations/20261008000000_inquiry_categories.sql once. It adds one category field; existing inquiries default to Customer inquiry. Existing resolved/unresolved history is preserved.

Private requests use Authorization: Bearer <existing GROK_BOT_SECRET>. Never place that key in browser code or URLs. Staff can also use their existing app session. Viewer accounts cannot change tickets. Grok sends email independently; these endpoints only store and update inquiries.

## Read

GET /api/inquiries?status=unresolved
GET /api/inquiries?status=resolved
GET /api/inquiries?status=unresolved&category=warranty
GET /api/inquiries?status=all&offset=100
GET /api/inquiries/{id}

List returns { tickets: [...], hasMore: boolean }. Batches contain up to 100. Status is unresolved or resolved. Category is customer_inquiry, warranty, delivery, returns or other. Customer email/name, original details and notes remain available. On list pagination keep requesting offset=100,200,... until hasMore=false. No public/anonymous access.

## Update after handling a customer

PATCH /api/inquiries/{id}
Content-Type: application/json

{"status":"resolved"}

Optional follow-up:
{"status":"unresolved","category":"warranty","notes":"Waiting for customer photos"}

Only status, category and notes may be changed here. The endpoint cannot edit customer identity or unrelated jobs. Notes are internal and do not send an email. The response is the updated ticket. Sending an email does not itself resolve a ticket; Grok explicitly changes its status after successful handling.

## Add an inquiry from another channel

POST /api/inquiries
Content-Type: application/json

{"name":"Customer","email":"customer@example.com","message":"Original inquiry","category":"customer_inquiry"}

The admin New ticket form uses this endpoint too. Email is optional for manual tickets; details are required. This is optional, for Grok to insert email/Instagram inquiries it already receives. It does not connect those services. POST creates a new ticket and is not automatically retry-idempotent: retain its returned ID before continuing; don't blindly retry an ambiguous creation result.

## Verification

npm run typecheck
./node_modules/.bin/tsc lib/inquiry-tickets.ts lib/inquiry-tickets.test.ts --module commonjs --target es2022 --esModuleInterop --outDir .sale-test-build/tickets --skipLibCheck
node --test .sale-test-build/tickets/inquiry-tickets.test.js

## October 8 conversation update

Statuses are now new, answered, waiting_on_customer, needs_tyson and closed. Old unresolved/resolved writes still map to new/closed. Lists default to New, hide tests and sort by last_activity_at. Query show_tests=true includes test tickets. List responses include counts for every status, scoped by category and test visibility.

GET /api/inquiries/{id}/messages returns chronological stored emails. Private bot POST /api/inquiries/messages imports a Gmail email:
{"provider_message_id":"gmail:unique-message-id","gmail_thread_id":"hex-thread-id","from_email":"team@luun.ca","to_email":"customer@example.com","subject":"Re: Your inquiry","body":"Reply text","sent_at":"2026-10-08T12:00:00Z"}

Only team@↔customer messages are accepted. Duplicate IDs are harmless; the newest team@ reply changes status to Answered. A newer customer reply returns the ticket to New, preserving Needs Tyson. Last activity advances only with new messages. Gmail thread ID is preferred for subsequent matching; initial match uses customer email. This endpoint stores messages, it does not send any email. Grokbot imports the emails it already receives; Luun Admin does not connect to Gmail itself.

## Attach the Gmail thread link (no Gmail connection required)

PATCH /api/inquiries/{id}
Authorization: Bearer <existing GROK_BOT_SECRET>
Content-Type: application/json

{"gmail_thread_url":"https://mail.google.com/mail/u/0/#inbox/THREAD","status":"answered"}

Use the real conversation URL from the team@ mailbox. The link appears as Open in Gmail on that ticket. Grokbot can add the URL alone, or include status in the same request after it sends a reply. No new key or Gmail authorization. To display email text inside the ticket as well, use the private POST /api/inquiries/messages endpoint above. The backend stores it without sending email.
