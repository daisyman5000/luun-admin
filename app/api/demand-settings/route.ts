import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { DemandMonthSetting } from "@/lib/types";

function cleanMonth(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

function cleanInteger(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update demand settings" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<DemandMonthSetting>;
  const month = cleanMonth(body.month);
  const maxDailyAdSpend = cleanInteger(body.max_daily_ad_spend, 0, 5000);
  const maxDaysApart = cleanInteger(body.max_days_apart, 1, 14);
  const saleDurationDays = cleanInteger(body.sale_duration_days, 1, 21);
  const saleStartDay = cleanInteger(body.sale_start_day, 1, 31);

  if (!month) {
    return NextResponse.json({ error: "Month is invalid" }, { status: 400 });
  }

  if (
    maxDailyAdSpend === undefined ||
    maxDaysApart === undefined ||
    saleDurationDays === undefined ||
    saleStartDay === undefined
  ) {
    return NextResponse.json({ error: "Demand settings are invalid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("demand_month_settings")
    .upsert({
      max_daily_ad_spend: maxDailyAdSpend,
      max_days_apart: maxDaysApart,
      month,
      sale_duration_days: saleDurationDays,
      sale_start_day: saleStartDay,
      updated_by: user.id
    }, { onConflict: "month" })
    .select()
    .single<DemandMonthSetting>();

  if (error) {
    const tableMissing =
      error.code === "42P01" ||
      error.message.toLowerCase().includes("schema cache") ||
      error.message.toLowerCase().includes("demand_month_settings");

    return NextResponse.json(
      {
        error: tableMissing
          ? "Demand settings are not ready in Supabase yet. Run the latest SQL migration once."
          : "Unable to save demand settings."
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
