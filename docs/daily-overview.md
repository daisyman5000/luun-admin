# Daily Luun Admin overview

`/overview` is the new Admin landing page. Existing owner/admin authorization applies to the page and GET `/api/overview`. No grants, credentials, schema changes, source refreshes, paid calls or website changes.

Reads saved Shopify orders, business Wise snapshot, actual payment evidence, inventory, containers, tickets, content, published-job records and plan commitments. Page links do not prefetch operational screens. Refresh only reloads database records.

Sales are recorded paid/part-paid full order values (not receipts), separated by currency and Vancouver business day. Test/cancelled/pending orders excluded. Cash excludes personal/unclassified profiles, preserves currency and genuine zeros, deduplicates balance IDs, and labels snapshots older than 24 hours stale. It does not establish coverage of all banks or reconciled closing cash. Partial actual receipts/payments are separate; missing evidence stays unknown.

Order actions use saved action text, payment and fulfilment statuses. Missing promised delivery dates never become invented late-order claims. Stock exceptions distinguish unreserved on-hand from reservations exceeding on-hand; the latter may be allocated to incoming containers. Physical inventory accuracy remains unverified.

Overdue work uses recorded dates only. Date-only work due today is not late; timed deadlines use the saved instant. Paid/cancelled items, closed/test inquiries, deleted/published content and successful publication jobs are excluded. Undated work is counted separately. Partial reads and 10,000-row caps are shown explicitly. Each section fails independently rather than claiming zero.

Tests: `node --test tests/daily-overview.test.cjs`; targeted ESLint; `npm run build`. Provider ports and database mutations are prohibited in the overview loader and tested. Production checks use only GET `/api/overview` and `/overview`; no POST or provider refresh.
