import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { WayflyerPayment, WayflyerPaymentStatus } from "@/lib/types";

const statuses = ["scheduled", "paid", "cancelled"] as const;

function cleanStatus(value: unknown): WayflyerPaymentStatus | undefined {
  if (typeof value !== "string") return undefined;
  return statuses.includes(value as WayflyerPaymentStatus) ? (value as WayflyerPaymentStatus) : undefined;
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
    return NextResponse.json({ error: "Not authorized to update Wayflyer payments" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<WayflyerPayment>;
  const status = cleanStatus(body.status);

  if (!status) {
    return NextResponse.json({ error: "Payment status is invalid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("wayflyer_payments")
    .update({ status })
    .eq("id", id)
    .select()
    .single<WayflyerPayment>();

  if (error) {
    return NextResponse.json({ error: "Unable to update Wayflyer payment" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to remove Wayflyer payments" }, { status: 403 });
  }

  const { error } = await supabase.from("wayflyer_payments").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to remove Wayflyer payment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
