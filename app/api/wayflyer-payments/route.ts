import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { WayflyerPayment } from "@/lib/types";

function cleanText(value: unknown, required = false) {
  if (typeof value !== "string") return required ? undefined : null;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  return trimmed;
}

function cleanMoney(value: unknown) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function addWeeks(date: string, weeks: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + weeks * 7);
  return nextDate.toISOString().slice(0, 10);
}

function cleanCurrency(value: unknown) {
  if (typeof value !== "string") return "CAD";
  const currency = value.trim().toUpperCase();
  return currency === "USD" || currency === "CAD" ? currency : undefined;
}

function cleanWeeks(value: unknown) {
  const weeks = Number(value || 1);
  if (!Number.isInteger(weeks) || weeks < 1) return undefined;
  return Math.min(weeks, 260);
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to add Wayflyer payments" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<WayflyerPayment> & { weeks?: unknown };
  const label = cleanText(body.label, true);
  const amount = cleanMoney(body.amount);
  const currency = cleanCurrency(body.currency);
  const dueDate = cleanDate(body.due_date);
  const weeks = cleanWeeks(body.weeks);

  if (!label) {
    return NextResponse.json({ error: "Payment label is required" }, { status: 400 });
  }

  if (amount === undefined) {
    return NextResponse.json({ error: "Payment amount is invalid" }, { status: 400 });
  }

  if (!currency) {
    return NextResponse.json({ error: "Payment currency is invalid" }, { status: 400 });
  }

  if (dueDate === undefined) {
    return NextResponse.json({ error: "Payment due date is invalid" }, { status: 400 });
  }

  if (!dueDate) {
    return NextResponse.json({ error: "First payment date is required" }, { status: 400 });
  }

  if (!weeks) {
    return NextResponse.json({ error: "Number of weeks is invalid" }, { status: 400 });
  }

  const rows = Array.from({ length: weeks }, (_, index) => ({
    amount,
    created_by: user.id,
    currency,
    due_date: addWeeks(dueDate, index),
    label: weeks === 1 ? label : `${label} ${index + 1}/${weeks}`,
    notes: cleanText(body.notes),
    status: "scheduled"
  }));

  const { data, error } = await supabase
    .from("wayflyer_payments")
    .insert(rows)
    .select()
    .returns<WayflyerPayment[]>();

  if (error) {
    const tableMissing =
      error.code === "42P01" ||
      error.message.toLowerCase().includes("schema cache") ||
      error.message.toLowerCase().includes("wayflyer_payments");

    return NextResponse.json(
      {
        error: tableMissing
          ? "Wayflyer payments are not ready in Supabase yet. Run the latest SQL migration once."
          : "Unable to add Wayflyer payment."
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
