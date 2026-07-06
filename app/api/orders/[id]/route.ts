import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { ShopifyOrder } from "@/lib/types";

const editableFields = [
  "delegate_order_id",
  "postal_code",
  "carrier",
  "delegate_order_created_at",
  "delivered_at",
  "delivery_status",
  "logistics_status",
  "internal_notes",
  "action_needed"
] as const;

type EditableField = (typeof editableFields)[number];

function cleanText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, profile } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update orders" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<Record<EditableField, unknown>>;
  const updates: Partial<Record<EditableField, string | null>> = {};

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      const value = cleanText(body[field]);

      if (value === undefined) {
        return NextResponse.json({ error: `${field} must be text` }, { status: 400 });
      }

      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid order fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shopify_orders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single<ShopifyOrder>();

  if (error) {
    return NextResponse.json({ error: "Unable to update order" }, { status: 500 });
  }

  return NextResponse.json(data);
}
