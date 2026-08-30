import { NextResponse } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";

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
    return NextResponse.json({ error: "Not authorized to remove invoices" }, { status: 403 });
  }

  const { error } = await supabase.from("major_expenses").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to remove invoice" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
