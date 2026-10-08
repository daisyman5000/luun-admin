import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import type { JobTicket } from "@/lib/types";

export async function GET(request: Request) {
  const { user, supabase } = await getUserContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const value = new URL(request.url).searchParams.get("offset") || "0";
  const offset = Number(value);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }
  const { data, error } = await supabase.from("job_tickets").select("*")
    .eq("category", "customer_inquiry").order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(offset, offset + 100).returns<JobTicket[]>();
  if (error) return NextResponse.json({ error: "Unable to load inquiries" }, { status: 500 });
  return NextResponse.json({ tickets: (data || []).slice(0,100), hasMore: (data || []).length > 100 },
    { headers: { "Cache-Control": "private, no-store" } });
}
