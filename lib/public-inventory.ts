import type { InventoryRow } from "@/lib/types";

type PublicInventorySource = Pick<
  InventoryRow,
  "fabric_slug" | "module_slug" | "available_qty" | "reserved_qty"
>;

export function buildPublicInventory(rows: PublicInventorySource[]) {
  return rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
    if (!row.fabric_slug || !row.module_slug) return acc;

    const available = Number(row.available_qty || 0) - Number(row.reserved_qty || 0);
    acc[row.fabric_slug] = acc[row.fabric_slug] || {};
    acc[row.fabric_slug][row.module_slug] = Math.max(available, 0);

    return acc;
  }, {});
}
