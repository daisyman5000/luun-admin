import "server-only";
import { buildPublicInventory } from "@/lib/public-inventory";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryRow } from "@/lib/types";

export async function getPublicInventoryPayload() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory")
    .select("fabric_slug,module_slug,available_qty,reserved_qty,builder_visible")
    .eq("builder_visible", true)
    .returns<Pick<
      InventoryRow,
      "fabric_slug" | "module_slug" | "available_qty" | "reserved_qty" | "builder_visible"
    >[]>();

  if (error) {
    throw new Error("Unable to load public inventory");
  }

  return buildPublicInventory(data || []);
}
