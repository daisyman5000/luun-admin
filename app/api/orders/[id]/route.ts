import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopifyOrder } from "@/lib/types";

const textFields = [
  "delegate_order_id",
  "postal_code",
  "carrier",
  "delegate_order_created_at",
  "delivered_at",
  "delivery_status",
  "internal_notes"
] as const;

const moduleFields = ["corner_qty", "armless_qty", "ottoman_qty"] as const;

type TextField = (typeof textFields)[number];
type ModuleField = (typeof moduleFields)[number];
type EditableField = TextField | ModuleField;

function cleanText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanQuantity(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function moduleSlugForField(field: ModuleField) {
  if (field === "corner_qty") return "corner";
  if (field === "armless_qty") return "armless";
  return "ottoman";
}

async function adjustInventoryForModuleChange({
  createdBy,
  delta,
  fabricSlug,
  moduleSlug,
  orderNumber,
  shopifyOrderId
}: {
  createdBy: string;
  delta: number;
  fabricSlug: string;
  moduleSlug: string;
  orderNumber: string | null;
  shopifyOrderId: string | null;
}) {
  if (delta === 0) return;

  const supabaseAdmin = createAdminClient();
  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from("inventory")
    .select("id, available_qty")
    .eq("fabric_slug", fabricSlug)
    .eq("module_slug", moduleSlug)
    .maybeSingle<{ id: string; available_qty: number | null }>();

  if (existingError) {
    throw new Error("Unable to load inventory row");
  }

  const availableDelta = -delta;

  if (existingRow?.id) {
    const nextAvailable = Math.max(Number(existingRow.available_qty || 0) + availableDelta, 0);
    const { error: updateError } = await supabaseAdmin
      .from("inventory")
      .update({
        available_qty: nextAvailable,
        updated_by: createdBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingRow.id);

    if (updateError) {
      throw new Error("Unable to update inventory");
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("inventory").insert({
      fabric_slug: fabricSlug,
      module_slug: moduleSlug,
      available_qty: Math.max(availableDelta, 0),
      updated_by: createdBy
    });

    if (insertError) {
      throw new Error("Unable to create inventory row");
    }
  }

  await supabaseAdmin.from("inventory_adjustments").insert({
    fabric_slug: fabricSlug,
    module_slug: moduleSlug,
    delta_available: availableDelta,
    reason: `Order ${orderNumber || shopifyOrderId || ""} module quantity changed`,
    source: "manual_order_module_edit",
    related_shopify_order_id: shopifyOrderId,
    created_by: createdBy
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, profile } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update orders" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<Record<EditableField, unknown>>;
  const updates: Partial<ShopifyOrder> = {};

  for (const field of textFields) {
    if (body[field] !== undefined) {
      const value = cleanText(body[field]);

      if (value === undefined) {
        return NextResponse.json({ error: `${field} must be text` }, { status: 400 });
      }

      updates[field] = value;
    }
  }

  for (const field of moduleFields) {
    if (body[field] !== undefined) {
      const value = cleanQuantity(body[field]);

      if (value === undefined) {
        return NextResponse.json({ error: `${field} must be a non-negative whole number` }, { status: 400 });
      }

      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid order fields provided" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: currentOrder, error: currentError } = await supabaseAdmin
    .from("shopify_orders")
    .select("*")
    .eq("id", id)
    .single<ShopifyOrder>();

  if (currentError || !currentOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (moduleFields.some((field) => updates[field] !== undefined)) {
    updates.total_modules =
      (updates.corner_qty ?? currentOrder.corner_qty ?? 0) +
      (updates.armless_qty ?? currentOrder.armless_qty ?? 0) +
      (updates.ottoman_qty ?? currentOrder.ottoman_qty ?? 0);
  }

  const { data, error } = await supabaseAdmin
    .from("shopify_orders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single<ShopifyOrder>();

  if (error) {
    return NextResponse.json({ error: "Unable to update order" }, { status: 500 });
  }

  if (currentOrder.fabric_slug) {
    try {
      for (const field of moduleFields) {
        const nextQuantity = updates[field];
        if (nextQuantity === undefined || nextQuantity === null) continue;

        await adjustInventoryForModuleChange({
          createdBy: user.id,
          delta: nextQuantity - Number(currentOrder[field] || 0),
          fabricSlug: currentOrder.fabric_slug,
          moduleSlug: moduleSlugForField(field),
          orderNumber: currentOrder.order_number,
          shopifyOrderId: currentOrder.shopify_order_id
        });
      }
    } catch (inventoryError) {
      return NextResponse.json(
        {
          error:
            inventoryError instanceof Error
              ? inventoryError.message
              : "Order saved, but inventory could not be updated"
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(data);
}
