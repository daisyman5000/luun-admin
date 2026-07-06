import { NextResponse, type NextRequest } from "next/server";
import { canManageUsers, getUserContext, isKnownRole } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, profile } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update users" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<Profile>;

  if (!isKnownRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: body.role })
    .eq("id", id)
    .select()
    .single<Profile>();

  if (error) {
    return NextResponse.json({ error: "Unable to update user" }, { status: 500 });
  }

  return NextResponse.json(data);
}
