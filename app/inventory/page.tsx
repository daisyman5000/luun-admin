import { InventoryTable } from "@/components/inventory-table";
import { SetupError } from "@/components/setup-error";
import { canManageInventory, requireUser } from "@/lib/auth";
import type { InventoryRow } from "@/lib/types";

export default async function InventoryPage() {
  const { supabase, profile } = await requireUser();
  const { data: rows, error } = await supabase
    .from("inventory")
    .select("*")
    .order("fabric_slug", { ascending: true })
    .returns<InventoryRow[]>();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-normal">Inventory</h1>
        <p className="mt-2 text-base text-slate-600">
          Available quantity by fabric and module.
        </p>
      </div>
      {error ? (
        <SetupError message={error.message} title="Inventory database issue" />
      ) : (
        <InventoryTable canEdit={canManageInventory(profile?.role)} initialRows={rows || []} />
      )}
    </main>
  );
}
