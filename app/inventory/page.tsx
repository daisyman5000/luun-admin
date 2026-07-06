import { InventoryTable } from "@/components/inventory-table";
import { canManageInventory, requireUser } from "@/lib/auth";
import type { InventoryRow } from "@/lib/types";

export default async function InventoryPage() {
  const { supabase, profile } = await requireUser();
  const { data: rows, error } = await supabase
    .from("inventory")
    .select("*")
    .order("fabric_slug", { ascending: true })
    .returns<InventoryRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Inventory</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fabric and module quantities used by staff and the future builder feed.
        </p>
      </div>
      <InventoryTable canEdit={canManageInventory(profile?.role)} initialRows={rows || []} />
    </main>
  );
}
