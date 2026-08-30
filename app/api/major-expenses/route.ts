import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { MajorExpense } from "@/lib/types";

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

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to add invoices" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<MajorExpense>;
  const label = cleanText(body.label, true);
  const amount = cleanMoney(body.amount);
  const dueDate = cleanDate(body.due_date);

  if (!label) {
    return NextResponse.json({ error: "Invoice name is required" }, { status: 400 });
  }

  if (amount === undefined) {
    return NextResponse.json({ error: "Invoice amount is invalid" }, { status: 400 });
  }

  if (dueDate === undefined) {
    return NextResponse.json({ error: "Invoice due date is invalid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("major_expenses")
    .insert({
      amount,
      created_by: user.id,
      due_date: dueDate,
      label,
      notes: cleanText(body.notes),
      status: "open"
    })
    .select()
    .single<MajorExpense>();

  if (error) {
    const tableMissing =
      error.code === "42P01" ||
      error.message.toLowerCase().includes("schema cache") ||
      error.message.toLowerCase().includes("major_expenses");

    return NextResponse.json(
      {
        error: tableMissing
          ? "Major invoices are not ready in Supabase yet. Run the latest SQL migration once."
          : "Unable to add invoice."
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
