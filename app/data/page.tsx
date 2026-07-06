import { OrdersTable } from "@/components/orders-table";
import { SetupError } from "@/components/setup-error";
import { ShopifySyncButton } from "@/components/shopify-sync-button";
import { canSyncShopifyOrders, requireUser } from "@/lib/auth";
import type { ShopifyOrder } from "@/lib/types";

type DataPageProps = {
  searchParams?: Promise<{
    shopify?: string | string[];
  }>;
};

export default async function DataPage({ searchParams }: DataPageProps) {
  const { supabase, profile } = await requireUser();
  const resolvedSearchParams = await searchParams;
  const { data: orders, error } = await supabase
    .from("shopify_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ShopifyOrder[]>();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Orders</h1>
        <p className="mt-1 text-sm text-slate-600">Shopify orders for logistics follow-up.</p>
      </div>
      {canSyncShopifyOrders(profile?.role) ? (
        <div className="mb-5">
          <ShopifySyncButton status={resolvedSearchParams?.shopify} />
        </div>
      ) : null}
      {error ? (
        <SetupError message={error.message} title="Orders database issue" />
      ) : (
        <OrdersTable orders={orders || []} />
      )}
    </main>
  );
}
