import { NextResponse } from "next/server";
import { buildPublicInventory } from "@/lib/public-inventory";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      return NextResponse.json({ error: "Unable to load public inventory" }, { status: 500 });
    }

    return NextResponse.json(buildPublicInventory(data || []));
  } catch {
    return NextResponse.json({ error: "Public inventory is not configured" }, { status: 500 });
  }
}
