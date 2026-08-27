import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { ContainerEntry, ContainerEntryStatus } from "@/lib/types";

const statuses = ["planning", "production", "in_transit", "arrived", "closed"] as const;

function cleanText(value: unknown, required = false) {
  if (typeof value !== "string") return required ? undefined : null;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  return trimmed;
}

function cleanMoney(value: unknown) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function cleanStatus(value: unknown): ContainerEntryStatus | undefined {
  if (typeof value !== "string") return undefined;
  return statuses.includes(value as ContainerEntryStatus) ? (value as ContainerEntryStatus) : undefined;
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to create containers" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<ContainerEntry>;
  const containerNumber = cleanText(body.container_number, true);
  const amountPaid = cleanMoney(body.amount_paid);
  const amountToBePaid = cleanMoney(body.amount_to_be_paid);
  const paymentDueAt = cleanDate(body.payment_due_at);
  const eta = cleanDate(body.eta);
  const status = cleanStatus(body.status || "planning");

  if (!containerNumber) {
    return NextResponse.json({ error: "Container number is required" }, { status: 400 });
  }

  if (amountPaid === undefined || amountToBePaid === undefined) {
    return NextResponse.json({ error: "Paid amounts must be positive numbers" }, { status: 400 });
  }

  if (paymentDueAt === undefined || eta === undefined || !status) {
    return NextResponse.json({ error: "Container dates or status are invalid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("container_entries")
    .insert({
      amount_paid: amountPaid,
      amount_to_be_paid: amountToBePaid,
      container_number: containerNumber,
      created_by: user.id,
      eta,
      notes: cleanText(body.notes),
      payment_due_at: paymentDueAt,
      purchase_order_id: cleanText(body.purchase_order_id),
      skus_on_board: cleanText(body.skus_on_board),
      status
    })
    .select()
    .single<ContainerEntry>();

  if (error) {
    return NextResponse.json({ error: "Unable to create container" }, { status: 500 });
  }

  return NextResponse.json(data);
}
