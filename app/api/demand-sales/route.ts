import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DemandSale } from "@/lib/types";

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function cleanDuration(value: unknown) {
  const duration = Number(value || 10);
  if (!Number.isInteger(duration) || duration < 1) return undefined;
  return Math.min(duration, 31);
}

function addDaysToDateString(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to plan sales" }, { status: 403 });
  }

  const body = (await request.json()) as { duration_days?: unknown; sale_date?: unknown };
  const saleDate = cleanDate(body.sale_date);
  const durationDays = cleanDuration(body.duration_days);

  if (!saleDate) {
    return NextResponse.json({ error: "Sale date is invalid" }, { status: 400 });
  }

  if (!durationDays) {
    return NextResponse.json({ error: "Sale duration is invalid" }, { status: 400 });
  }

  const rows = Array.from({ length: durationDays }, (_, index) => ({
    created_by: user.id,
    sale_date: addDaysToDateString(saleDate, index)
  }));
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("demand_sales")
    .upsert(rows, { onConflict: "sale_date" })
    .select()
    .returns<DemandSale[]>();

  if (error) {
    const tableMissing =
      error.code === "42P01" ||
      error.message.toLowerCase().includes("schema cache") ||
      error.message.toLowerCase().includes("demand_sales");

    return NextResponse.json(
      {
        error: tableMissing
          ? "Demand sales table is not ready in Supabase yet. Run the demand_sales SQL migration once."
          : "Unable to save sale. Please refresh and try again."
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
