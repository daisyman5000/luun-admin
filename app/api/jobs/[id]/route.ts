import { NextResponse, type NextRequest } from "next/server";
import { canManageUsers, canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import type { JobTicket, JobTicketCategory, JobTicketPriority, JobTicketStatus } from "@/lib/types";

const categories = [
  "customer_inquiry",
  "ads_created",
  "customer_followup_reviews",
  "social_media_posts",
  "technology_improvements"
] as const;
const statuses = ["open", "in_progress", "blocked", "done"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;

function cleanText(value: unknown, required = false) {
  if (value === undefined) return undefined;
  if (value === null) return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  return trimmed;
}

function cleanDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function cleanCategory(value: unknown): JobTicketCategory | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" && categories.includes(value as JobTicketCategory)
    ? (value as JobTicketCategory)
    : undefined;
}

function cleanStatus(value: unknown): JobTicketStatus | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" && statuses.includes(value as JobTicketStatus)
    ? (value as JobTicketStatus)
    : undefined;
}

function cleanPriority(value: unknown): JobTicketPriority | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" && priorities.includes(value as JobTicketPriority)
    ? (value as JobTicketPriority)
    : undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to update jobs" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<JobTicket>;
  const updates: Record<string, string | null> = {};
  const textFields = [
    "customer_email",
    "customer_name",
    "details",
    "next_step",
    "order_number",
    "owner_name",
    "title"
  ] as const;

  for (const field of textFields) {
    if (body[field] !== undefined) {
      const value = cleanText(body[field], field === "title");
      if (value === undefined) {
        return NextResponse.json({ error: `${field} is invalid` }, { status: 400 });
      }
      updates[field] = value;
    }
  }

  const category = cleanCategory(body.category);
  if (body.category !== undefined) {
    if (!category) return NextResponse.json({ error: "Category is invalid" }, { status: 400 });
    updates.category = category;
  }

  const status = cleanStatus(body.status);
  if (body.status !== undefined) {
    if (!status) return NextResponse.json({ error: "Status is invalid" }, { status: 400 });
    updates.status = status;
  }

  const priority = cleanPriority(body.priority);
  if (body.priority !== undefined) {
    if (!priority) return NextResponse.json({ error: "Priority is invalid" }, { status: 400 });
    updates.priority = priority;
  }

  const dueAt = cleanDate(body.due_at);
  if (body.due_at !== undefined) {
    if (dueAt === undefined) return NextResponse.json({ error: "Due date is invalid" }, { status: 400 });
    updates.due_at = dueAt;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid job fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_tickets")
    .update(updates)
    .eq("id", id)
    .select()
    .single<JobTicket>();

  if (error) {
    return NextResponse.json({ error: "Unable to update job" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageUsers(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to delete jobs" }, { status: 403 });
  }

  const { error } = await supabase.from("job_tickets").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete job" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
