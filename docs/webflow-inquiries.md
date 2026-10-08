# Webflow inquiry inbox

Website form → Webflow storage / existing team email → authenticated webhook → existing `job_tickets` customer inquiry → `/ticketing`.

No new database migration. Uses existing ticket role policies and existing status-update endpoint. The inbox reads only customer inquiries. Email replies open a draft in the staff member's email app; no automated customer messages are sent.

Configure a random 32-byte hex `WEBFLOW_INQUIRY_TOKEN` in Vercel production. Register one site-wide Webflow `form_submission` webhook to `https://luun-admin-et42.vercel.app/api/webflow/inquiries?token=SECRET`. Never put the secret in public Webflow code or commit it. This capability URL authorizes writes only, not inbox reads. Webflow's connector uses its own OAuth signing key, which is not available to Luun Admin; the private capability token authenticates this integration instead.

Receiver checks the token, site, trigger, submission ID, date, message and body size. Deterministic IDs plus ignore-duplicate upserts prevent retries from creating duplicates or resetting status. A success response is returned only after saving. Failed saves return 503 for Webflow's retry mechanism. Existing Webflow submissions and email notifications remain a recovery source if the integration fails.

Register the webhook only after deployment and an unauthorized endpoint check. Verify one marked test through the actual public form; confirm the ticket and original message arrive in the authenticated inbox. Historical submissions are not automatically imported.

Regression checks:
`./node_modules/.bin/tsc lib/webflow-inquiries.ts lib/webflow-inquiries.test.ts --module commonjs --target es2020 --esModuleInterop --outDir .sale-test-build/inquiries --skipLibCheck && node --test .sale-test-build/inquiries/webflow-inquiries.test.js`
