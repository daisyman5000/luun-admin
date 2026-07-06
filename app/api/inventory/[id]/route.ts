import { NextResponse, type NextRequest } from "next/server";
import { canManageInventory, getUserContext } from "@/lib/auth";
import type { InventoryRow } from "@/lib/types";

const numericFields = ["available_qty"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, profile } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageInventory(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update inventory" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<InventoryRow>;
  const updates: Partial<InventoryRow> = {};

  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < 0) {
        return NextResponse.json({ error: `${field} must be a non-negative integer` }, { status: 400 });
      }
      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid inventory fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("inventory")
    .update(updates)
    .eq("id", id)
    .select()
    .single<InventoryRow>();

  if (error) {
    return NextResponse.json({ error: "Unable to update inventory" }, { status: 500 });
  }

  return NextResponse.json(data);
}
