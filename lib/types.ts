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
  delegate_order_id: string | null;
  postal_code: string | null;
  carrier: string | null;
  delegate_order_created_at: string | null;
  delivered_at: string | null;
  delivery_status: string | null;
  action_needed: string | null;
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

export type ContainerEntryStatus = "planning" | "production" | "in_transit" | "arrived" | "closed";

export type ContainerManifestItem = {
  color: string;
  module: string;
  quantity: number;
};

export type ContainerEntry = {
  id: string;
  container_number: string;
  purchase_order_id: string | null;
  skus_on_board: string | null;
  manifest_json: ContainerManifestItem[] | null;
  amount_paid: number | null;
  amount_to_be_paid: number | null;
  payment_due_at: string | null;
  eta: string | null;
  status: ContainerEntryStatus | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobTicketCategory =
  | "customer_inquiry"
  | "ads_created"
  | "customer_followup_reviews"
  | "social_media_posts"
  | "technology_improvements";

export type JobTicketStatus = "open" | "in_progress" | "blocked" | "done";
export type JobTicketPriority = "low" | "normal" | "high" | "urgent";

export type JobTicket = {
  id: string;
  title: string;
  category: JobTicketCategory;
  status: JobTicketStatus;
  priority: JobTicketPriority;
  customer_name: string | null;
  customer_email: string | null;
  order_number: string | null;
  owner_name: string | null;
  details: string | null;
  next_step: string | null;
  due_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DemandSale = {
  id: string;
  sale_date: string;
  created_by: string | null;
  created_at: string;
};

export type MajorExpenseStatus = "open" | "paid" | "cancelled";

export type MajorExpense = {
  id: string;
  label: string;
  amount: number | null;
  due_date: string | null;
  status: MajorExpenseStatus | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WayflyerPaymentStatus = "scheduled" | "paid" | "cancelled";

export type WayflyerPayment = {
  id: string;
  label: string;
  amount: number | null;
  due_date: string | null;
  status: WayflyerPaymentStatus | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
