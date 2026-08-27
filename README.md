# Luun Admin

Private admin portal for Luun logistics. The first version replaces the working Google Sheet with authenticated Shopify order and inventory tables.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Vercel

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=
   SHOPIFY_STORE_DOMAIN=luunsofa.myshopify.com
   SHOPIFY_CLIENT_ID=
   SHOPIFY_CLIENT_SECRET=
   SHOPIFY_WEBHOOK_SECRET=
   WISE_API_TOKEN=
   ```

   `SUPABASE_SECRET_KEY`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET`, and `WISE_API_TOKEN` are server-only values. Never prefix them with `NEXT_PUBLIC_`.

   The app still supports older Supabase variable names for compatibility:

   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used only when `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing.
   - `SUPABASE_SERVICE_ROLE_KEY` is used only when `SUPABASE_SECRET_KEY` is missing.

4. In Supabase, go to **Settings > API Keys**:

   - Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the publishable key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Copy the secret key into `SUPABASE_SECRET_KEY`.

5. Apply the Supabase migrations in `supabase/migrations`.

6. Create the first Supabase Auth user, then promote that user in SQL:

   ```sql
   update public.profiles
   set role = 'owner'
   where email = 'you@example.com';
   ```

   The `public.profiles.id` value must match `auth.users.id`. The migrations create a trigger on `auth.users` that inserts a matching `public.profiles` row using `new.id` whenever a new auth user is created. Role checks read from `public.profiles`; browser/client code never queries `auth.users` directly.

7. Run the app:

   ```bash
   npm run dev
   ```

## Routes

- `/login` signs staff in with Supabase Auth.
- `/data` shows Shopify orders with search and status filters.
- `/inventory` shows inventory rows. Owner/admin users can edit quantities and builder visibility.
- `/financials` shows Wise cash balances for owner/admin users.
- `/settings/users` lets owner/admin users manage profile roles and view safe Supabase diagnostics.
- `/api/public-inventory` returns public builder-safe inventory JSON.
- `POST /api/shopify/import-orders` manually imports recent Shopify orders for owner/admin users.
- `POST /api/shopify/webhooks/orders` receives verified Shopify `orders/create` and `orders/updated` webhooks.
- `GET /api/wise/summary` returns server-side Wise balance summaries for owner/admin users.
- `GET /api/settings/diagnostics` returns safe Supabase configuration/profile diagnostics for owner/admin users.

## Wise Financial Data

Wise data is loaded server-side only. The browser never receives the Wise API token.

Required environment variables:

```bash
WISE_API_TOKEN=
```

Use a Wise business personal API token from **Wise > Your account > Connect and manage apps > API tokens**. The app uses that token to find the Wise business profile automatically, then reads Wise balance accounts only so the app can show cashflow balances. It does not request Wise statements or transaction history.

## Shopify Manual Sync

Manual sync uses the Shopify Admin GraphQL API. It does not use webhooks and does not adjust inventory.

Required environment variables:

```bash
SHOPIFY_STORE_DOMAIN=luunsofa.myshopify.com
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_WEBHOOK_SECRET=
```

The app uses Shopify's OAuth install flow. The Client ID, Client Secret, webhook secret, and generated Admin API token are kept server-side. An owner/admin connects Shopify once from `/data`; Shopify redirects back to `/api/shopify/callback`; then the app stores the generated Admin API access token in `public.shopify_connections` using the server-only Supabase secret key.

After Shopify connects, the app registers automatic order webhooks for:

- `orders/create`
- `orders/updated`

Both webhooks post to:

```text
https://your-admin-domain.com/api/shopify/webhooks/orders
```

The Shopify app needs read access to orders. In Shopify app permissions, enable:

- `read_orders`

If Luun needs to import older orders beyond Shopify's normal recent order window, also enable the protected customer data/order history permissions required by the Shopify admin.

In the Shopify app settings, add this allowed redirect URL:

```
https://your-admin-domain.com/api/shopify/callback
```

Owner/admin users can run a sync from `/data`:

1. Click **Connect Shopify** once and approve the Shopify app.
2. Return to `/data`.
3. New and updated orders should import automatically.

The manual **Sync Shopify Orders** button remains as a backup. The sync imports orders since June 24, 2026. `POST /api/shopify/import-orders` also accepts an optional `limit` value. The endpoint requires a logged-in owner/admin session, so browser-based use from `/data` is the expected workflow.

Diagnostics in `/settings/users` check whether the Shopify and Wise env vars exist, whether Shopify has been connected, and whether the Shopify/Wise APIs respond.

## Database Notes

The migration enables Row Level Security and grants the narrow browser permissions needed by the app:

- Authenticated users can read orders and inventory.
- Owner/admin users can manage inventory and profiles.
- Owner/admin/logistics users can update only `logistics_status`, `internal_notes`, and `updated_at` on orders.
- The public inventory endpoint uses the server-only Supabase secret key and returns only `builder_visible = true` rows.
- `public.profiles.id` references `auth.users(id)` and is created by the `public.handle_new_user()` trigger from `auth.users.new.id`.
- `public.shopify_connections` stores the Shopify Admin API token. RLS is enabled and browser roles receive no table grants.

## Deployment

Deploy to Vercel and add the same environment variables there. Keep `SUPABASE_SECRET_KEY`, Shopify secrets, and Wise secrets scoped to server-side use only.
