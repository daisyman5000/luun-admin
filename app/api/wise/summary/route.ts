import { NextResponse } from "next/server";
import { canViewFinancials, getUserContext } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";

export async function GET() {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canViewFinancials(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to view Wise data" }, { status: 403 });
  }

  const summary = await getWiseSummary();

  return NextResponse.json(summary);
}
