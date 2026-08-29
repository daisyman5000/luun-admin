import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DemandSale } from "@/lib/types";

const minimumDaysBetweenSaleStarts = 17;

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function addDaysToDateString(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function daysBetweenDates(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00`);
  const rightDate = new Date(`${right}T00:00:00`);
  return Math.abs(Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000));
}

export async function POST(request: NextRequest) {
  const { profile, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to plan sales" }, { status: 403 });
  }

  const body = (await request.json()) as { sale_date?: unknown };
  const saleDate = cleanDate(body.sale_date);

  if (!saleDate) {
    return NextResponse.json({ error: "Sale date is invalid" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: existingSales, error: existingSalesError } = await supabaseAdmin
    .from("demand_sales")
    .select("sale_date")
    .gte("sale_date", addDaysToDateString(saleDate, -minimumDaysBetweenSaleStarts + 1))
    .lte("sale_date", addDaysToDateString(saleDate, minimumDaysBetweenSaleStarts - 1))
    .returns<Pick<DemandSale, "sale_date">[]>();

  if (existingSalesError) {
    const tableMissing =
      existingSalesError.code === "42P01" ||
      existingSalesError.message.toLowerCase().includes("schema cache") ||
      existingSalesError.message.toLowerCase().includes("demand_sales");

    return NextResponse.json(
      {
        error: tableMissing
          ? "Demand sales table is not ready in Supabase yet. Run the demand_sales SQL migration once."
          : "Unable to check existing sales. Please refresh and try again."
      },
      { status: 500 }
    );
  }

  const tooClose = (existingSales || []).some((sale) =>
    sale.sale_date !== saleDate && daysBetweenDates(sale.sale_date, saleDate) < minimumDaysBetweenSaleStarts
  );

  if (tooClose) {
    return NextResponse.json({ error: "Sales need at least 10 days live plus 7 blank days between starts." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("demand_sales")
    .insert({ created_by: user.id, sale_date: saleDate })
    .select()
    .single<DemandSale>();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A sale already exists on this date." }, { status: 409 });
    }

    return NextResponse.json({ error: "Unable to save sale. Please refresh and try again." }, { status: 500 });
  }

  return NextResponse.json(data);
}
