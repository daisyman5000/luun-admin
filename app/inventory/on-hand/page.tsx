import { InventoryOnHandTable } from "@/components/inventory-on-hand-table";
import { InventoryTabs } from "@/components/inventory-tabs";
import { SetupError } from "@/components/setup-error";
import { requireUser } from "@/lib/auth";
import type { InventoryRow } from "@/lib/types";

export default async function InventoryOnHandPage() {
  const { supabase } = await requireUser();
  const { data: rows, error } = await supabase
    .from("inventory")
    .select("*")
    .order("fabric_slug", { ascending: true })
    .returns<InventoryRow[]>();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Inventory</h1>
        <p className="mt-1 text-sm text-slate-600">
          Available inventory on hand by fabric and module.
        </p>
      </div>
      <InventoryTabs active="on-hand" />
      {error ? (
        <SetupError message={error.message} title="Inventory database issue" />
      ) : (
        <InventoryOnHandTable rows={rows || []} />
      )}
    </main>
  );
}
