import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { DemandSale } from "@/lib/types";

const minimumDaysBetweenSaleStarts = 17;

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function daysBetweenDates(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00`);
  const rightDate = new Date(`${right}T00:00:00`);
  return Math.abs(Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000));
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

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

  const { data: existingSales, error: existingSalesError } = await supabase
    .from("demand_sales")
    .select("sale_date")
    .returns<Pick<DemandSale, "sale_date">[]>();

  if (existingSalesError) {
    return NextResponse.json({ error: "Unable to check existing sales" }, { status: 500 });
  }

  const tooClose = (existingSales || []).some((sale) =>
    sale.sale_date !== saleDate && daysBetweenDates(sale.sale_date, saleDate) < minimumDaysBetweenSaleStarts
  );

  if (tooClose) {
    return NextResponse.json({ error: "Sales need at least 10 days live plus 7 blank days between starts." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("demand_sales")
    .upsert({ created_by: user.id, sale_date: saleDate }, { onConflict: "sale_date" })
    .select()
    .single<DemandSale>();

  if (error) {
    return NextResponse.json({ error: "Unable to save sale" }, { status: 500 });
  }

  return NextResponse.json(data);
}
