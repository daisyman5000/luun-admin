import { NextResponse } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to delete planned sales" }, { status: 403 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("demand_sales").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete sale" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
