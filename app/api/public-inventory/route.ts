import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = (data || []).reduce<Record<string, Record<string, number>>>((acc, row) => {
    if (!row.fabric_slug || !row.module_slug) return acc;
    const available = Number(row.available_qty || 0) - Number(row.reserved_qty || 0);
    acc[row.fabric_slug] = acc[row.fabric_slug] || {};
    acc[row.fabric_slug][row.module_slug] = Math.max(available, 0);
    return acc;
  }, {});

  return NextResponse.json(grouped);
}
