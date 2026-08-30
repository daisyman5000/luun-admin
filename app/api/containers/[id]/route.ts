import { NextResponse, type NextRequest } from "next/server";
import { canManageUsers, canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { ContainerEntry, ContainerEntryStatus, ContainerManifestItem } from "@/lib/types";

const statuses = ["planning", "production", "in_transit", "arrived", "closed"] as const;

function cleanText(value: unknown, required = false) {
  if (value === undefined) return undefined;
  if (value === null) return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  return trimmed;
}

function cleanMoney(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function cleanDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function cleanStatus(value: unknown): ContainerEntryStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  return statuses.includes(value as ContainerEntryStatus) ? (value as ContainerEntryStatus) : undefined;
}

function cleanManifest(value: unknown): ContainerManifestItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const manifest: ContainerManifestItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;

    const record = item as Record<string, unknown>;
    const color = cleanText(record.color, true);
    const moduleName = cleanText(record.module, true);
    const quantity = Number(record.quantity);

    if (!color || !moduleName || !Number.isInteger(quantity) || quantity < 0) {
      return undefined;
    }

    if (quantity > 0) {
      manifest.push({ color, module: moduleName, quantity });
    }
  }

  return manifest;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update containers" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<ContainerEntry>;
  const updates: Partial<ContainerEntry> = {};

  const containerNumber = cleanText(body.container_number, true);
  if (body.container_number !== undefined) {
    if (!containerNumber) {
      return NextResponse.json({ error: "Container number is required" }, { status: 400 });
    }
    updates.container_number = containerNumber;
  }

  const purchaseOrderId = cleanText(body.purchase_order_id);
  if (purchaseOrderId !== undefined) updates.purchase_order_id = purchaseOrderId;

  const skusOnBoard = cleanText(body.skus_on_board);
  if (skusOnBoard !== undefined) updates.skus_on_board = skusOnBoard;

  const manifest = cleanManifest(body.manifest_json);
  if (body.manifest_json !== undefined) {
    if (!manifest) {
      return NextResponse.json({ error: "Container manifest is invalid" }, { status: 400 });
    }
    updates.manifest_json = manifest;
  }

  const amountPaid = cleanMoney(body.amount_paid);
  if (amountPaid !== undefined) updates.amount_paid = amountPaid;

  const amountToBePaid = cleanMoney(body.amount_to_be_paid);
  if (amountToBePaid !== undefined) updates.amount_to_be_paid = amountToBePaid;

  if (body.amount_currency !== undefined) updates.amount_currency = "USD";

  const paymentDueAt = cleanDate(body.payment_due_at);
  if (paymentDueAt !== undefined) updates.payment_due_at = paymentDueAt;

  const eta = cleanDate(body.eta);
  if (eta !== undefined) updates.eta = eta;

  const status = cleanStatus(body.status);
  if (status !== undefined) updates.status = status;

  const notes = cleanText(body.notes);
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid container fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("container_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single<ContainerEntry>();

  if (error) {
    return NextResponse.json({ error: "Unable to update container" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to delete containers" }, { status: 403 });
  }

  const { error } = await supabase.from("container_entries").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete container" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
