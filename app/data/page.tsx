import { OrdersTable } from "@/components/orders-table";
import { ShopifySyncButton } from "@/components/shopify-sync-button";
import { canSyncShopifyOrders, requireUser } from "@/lib/auth";
import type { ShopifyOrder } from "@/lib/types";

export default async function DataPage() {
  const { supabase, profile } = await requireUser();
  const { data: orders, error } = await supabase
    .from("shopify_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ShopifyOrder[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Orders</h1>
        <p className="mt-1 text-sm text-slate-600">Shopify orders for logistics follow-up.</p>
      </div>
      {canSyncShopifyOrders(profile?.role) ? (
        <div className="mb-5">
          <ShopifySyncButton />
        </div>
      ) : null}
      <OrdersTable orders={orders || []} />
    </main>
  );
}
