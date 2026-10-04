# Demand Plan sale control

Status: implementation prepared; sale remains OFF. Do not merge/install the storefront bridge before checkout access and the migration are ready.

The Website sale panel lives within Demand Plan. It applies an additional 35% after existing quantity discounts (3 modules:11%; 4–5:14%; 6+:15%). Forecast-calendar edits never start a storefront sale.

## Required setup

1. Run `supabase/migrations/20261004000000_sale_control.sql` in the existing database. Default state is off; tables are server-only with RLS and no browser grants.
2. Approve adding `read_discounts`, `write_discounts`, and `read_products` to the existing Shopify app, then include those scopes in its OAuth install configuration and reconnect it. Existing order sync remains unchanged. Do not grant product-write or order-write access.
3. Configure `SHOPIFY_STOREFRONT_ACCESS_TOKEN` server-side for Cart API checkout verification. Confirm all module variants are published to that sales channel.
4. Deploy this branch to a Vercel preview and verify owner/admin permissions. Production activation must use the production database and store; preview must have isolated settings or leave its Start button unused.
5. Install `docs/storefront-sale-bridge.js` once after the current global pricing script in Webflow. Publish, verify banner placement and builder totals, then set `SALE_STOREFRONT_BRIDGE_VERSION=1` on the production admin. Leave the sale off throughout setup.
6. In Shopify, check that existing quantity product discounts permit order-discount combinations. Do not change their rates. The managed promotion is an order discount, combines with product discounts only, and is restricted by this app to its own discount ID/title.
7. Before activation, compare 2/3/4/5/6/7-module Shopify carts across all five fabrics. The Start flow performs this check on baseline and sale totals. Any mismatch rejects activation and tries to expire the managed discount.

## Operational limits / remaining verification

- Manual Start only. End time automatically expires both site and Shopify promotion. Future scheduled start is explicitly rejected; scheduling needs a separate tested worker.
- Activation rejects other active merchandise or changed module prices. Shopify order discounts apply to all items, so extra merchandise requires an eligibility redesign before activation.
- Tax and shipping are additional and Shopify-calculated. Test financing availability on sale checkout.
- Whole-dollar website rounding previously differed from checkout (two corners: site $2,970 vs checkout $2,969.24; four modules: site $4,009 vs checkout $4,008.95). Sale prices display cents; regular mode preserves existing presentation.
- Pricing estimates use observed Shopify per-unit rounding. Only successful Shopify cart comparisons establish correctness for the tested configurations. Add further quantities/mixes if the store's discount implementation differs.
- A failed rollback is shown explicitly; use End sale and verify Shopify before continuing. Never report a successful start if any check failed.
- Public checkout endpoint uses a database rate limit of six requests per IP per minute; confirm the trusted proxy supplies `x-forwarded-for` in production. Database and Vercel integration setup are still required; this branch is not ready for production activation.
