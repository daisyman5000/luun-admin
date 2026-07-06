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
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SHOPIFY_STORE_DOMAIN=
   SHOPIFY_ADMIN_ACCESS_TOKEN=
   SHOPIFY_WEBHOOK_SECRET=
   ```

   `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, and `SHOPIFY_WEBHOOK_SECRET` are server-only values. Never prefix them with `NEXT_PUBLIC_`.

4. Apply the Supabase migration in `supabase/migrations/20260706000000_initial_schema.sql`.

5. Create the first Supabase Auth user, then promote that user in SQL:

   ```sql
   update public.profiles
   set role = 'owner'
   where email = 'you@example.com';
   ```

6. Run the app:

   ```bash
   npm run dev
   ```

## Routes

- `/login` signs staff in with Supabase Auth.
- `/data` shows Shopify orders with search and status filters.
- `/inventory` shows inventory rows. Owner/admin users can edit quantities and builder visibility.
- `/settings/users` lets owner/admin users manage profile roles.
- `/api/public-inventory` returns public builder-safe inventory JSON.

## Database Notes

The migration enables Row Level Security and grants the narrow browser permissions needed by the app:

- Authenticated users can read orders and inventory.
- Owner/admin users can manage inventory and profiles.
- Owner/admin/logistics users can update only `logistics_status`, `internal_notes`, and `updated_at` on orders.
- The public inventory endpoint uses the server-only Supabase service role key and returns only `builder_visible = true` rows.

## Deployment

Deploy to Vercel and add the same environment variables there. Keep the service role and Shopify secrets scoped to server-side use only.
