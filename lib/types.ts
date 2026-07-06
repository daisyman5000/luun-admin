export type UserRole = "owner" | "admin" | "logistics" | "viewer";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type ShopifyOrder = {
  id: string;
  shopify_order_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_price: number | null;
  currency: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  shipping_address_json: Record<string, unknown> | null;
  fabric_slug: string | null;
  corner_qty: number | null;
  armless_qty: number | null;
  ottoman_qty: number | null;
  total_modules: number | null;
  logistics_status: string | null;
  internal_notes: string | null;
  raw_shopify_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type InventoryRow = {
  id: string;
  fabric_slug: string | null;
  module_slug: string | null;
  available_qty: number | null;
  reserved_qty: number | null;
  incoming_qty: number | null;
  low_stock_threshold: number | null;
  builder_visible: boolean | null;
  updated_by: string | null;
  updated_at: string;
};
