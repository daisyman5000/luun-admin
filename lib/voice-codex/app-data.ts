import type { createClient } from "@/lib/supabase/server";

type SupabaseReader = Awaited<ReturnType<typeof createClient>>;

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

async function readQuery(label: string, query: unknown) {
  const result = (await query) as QueryResult;
  const data = result.error ? null : result.data;

  return {
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    data,
    error: result.error?.message || null,
    label
  };
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 24000);
}

export async function buildVoiceCodexAppDataSnapshot(supabase: SupabaseReader, role?: string | null) {
  const recentDate = isoDaysAgo(120);
  const financialAccess = role === "owner" || role === "admin";

  const [inventory, recentOrders, containers, demandSales, jobs, majorExpenses, wayflyerPayments] = await Promise.all([
    readQuery(
      "Inventory",
      supabase
        .from("inventory")
        .select("fabric_slug,module_slug,available_qty,reserved_qty,incoming_qty,low_stock_threshold,builder_visible,updated_at")
        .order("fabric_slug", { ascending: true })
    ),
    readQuery(
      "Recent Shopify orders",
      supabase
        .from("shopify_orders")
        .select(
          "order_number,created_at,total_price,currency,payment_status,fulfillment_status,fabric_slug,corner_qty,armless_qty,ottoman_qty,total_modules,logistics_status,delivery_status,action_needed,internal_notes"
        )
        .gte("created_at", recentDate)
        .order("created_at", { ascending: false })
        .limit(80)
    ),
    readQuery(
      "Containers",
      supabase
        .from("container_entries")
        .select(
          "container_number,purchase_order_id,skus_on_board,manifest_json,amount_paid,amount_to_be_paid,amount_currency,payment_due_at,eta,status,notes,updated_at"
        )
        .order("eta", { ascending: true, nullsFirst: false })
        .limit(80)
    ),
    readQuery(
      "Demand sales calendar",
      supabase.from("demand_sales").select("sale_date,created_at").order("sale_date", { ascending: true }).limit(120)
    ),
    readQuery(
      "Job tickets",
      supabase
        .from("job_tickets")
        .select("title,category,status,priority,customer_name,order_number,owner_name,details,next_step,due_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(80)
    ),
    financialAccess
      ? readQuery(
          "Major expenses",
          supabase
            .from("major_expenses")
            .select("label,amount,currency,due_date,status,notes,updated_at")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(80)
        )
      : Promise.resolve({ count: 0, data: null, error: "Hidden from this user role", label: "Major expenses" }),
    financialAccess
      ? readQuery(
          "Wayflyer payments",
          supabase
            .from("wayflyer_payments")
            .select("label,amount,currency,due_date,status,notes,updated_at")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(80)
        )
      : Promise.resolve({ count: 0, data: null, error: "Hidden from this user role", label: "Wayflyer payments" })
  ]);

  return `
Read-only Luun Admin data snapshot
Generated: ${new Date().toISOString()}
Scope: current signed-in user's Supabase permissions. Raw Shopify JSON, customer emails, phone numbers, and addresses are intentionally excluded.

Loaded datasets:
${[inventory, recentOrders, containers, demandSales, jobs, majorExpenses, wayflyerPayments]
  .map((result) => `- ${result.label}: ${result.error ? `unavailable (${result.error})` : `${result.count} rows`}`)
  .join("\n")}

${compactJson([inventory, recentOrders, containers, demandSales, jobs, majorExpenses, wayflyerPayments])}
`.trim();
}
