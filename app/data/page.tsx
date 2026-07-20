import { OrdersTable } from "@/components/orders-table";
import { SetupError } from "@/components/setup-error";
import { ShopifySyncButton } from "@/components/shopify-sync-button";
import { canSyncShopifyOrders, requireUser } from "@/lib/auth";
import type { ShopifyOrder } from "@/lib/types";

type DataPageProps = {
  searchParams?: Promise<{
    shopify?: string | string[];
    shopify_reason?: string | string[];
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
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-normal">Orders</h1>
        {canSyncShopifyOrders(profile?.role) ? (
          <ShopifySyncButton
            reason={resolvedSearchParams?.shopify_reason}
            status={resolvedSearchParams?.shopify}
          />
        ) : null}
      </div>
      {error ? (
        <SetupError message={error.message} title="Orders database issue" />
      ) : (
        <OrdersTable orders={orders || []} />
      )}
    </main>
  );
}
