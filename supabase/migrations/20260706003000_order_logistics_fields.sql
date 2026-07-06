alter table public.shopify_orders
add column if not exists delegate_order_id text,
add column if not exists postal_code text,
add column if not exists carrier text,
add column if not exists delegate_order_created_at text,
add column if not exists delivered_at text,
add column if not exists delivery_status text,
add column if not exists action_needed text;

grant update (
  delegate_order_id,
  postal_code,
  carrier,
  delegate_order_created_at,
  delivered_at,
  delivery_status,
  logistics_status,
  internal_notes,
  action_needed,
  updated_at
) on public.shopify_orders to authenticated;
