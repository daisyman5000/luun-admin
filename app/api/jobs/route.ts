import { NextResponse, type NextRequest } from "next/server";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
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
  if (typeof value !== "string") return required ? undefined : null;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  return trimmed;
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
}

function cleanCategory(value: unknown): JobTicketCategory | undefined {
  return typeof value === "string" && categories.includes(value as JobTicketCategory)
    ? (value as JobTicketCategory)
    : undefined;
}

function cleanStatus(value: unknown): JobTicketStatus | undefined {
  return typeof value === "string" && statuses.includes(value as JobTicketStatus)
    ? (value as JobTicketStatus)
    : undefined;
}

function cleanPriority(value: unknown): JobTicketPriority | undefined {
  return typeof value === "string" && priorities.includes(value as JobTicketPriority)
    ? (value as JobTicketPriority)
    : undefined;
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to create jobs" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<JobTicket>;
  const title = cleanText(body.title, true);
  const category = cleanCategory(body.category);
  const status = cleanStatus(body.status || "open");
  const priority = cleanPriority(body.priority || "normal");
  const dueAt = cleanDate(body.due_at);

  if (!title) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }

  if (!category || !status || !priority || dueAt === undefined) {
    return NextResponse.json({ error: "Job category, status, priority, or due date is invalid" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_tickets")
    .insert({
      category,
      created_by: user.id,
      customer_email: cleanText(body.customer_email),
      customer_name: cleanText(body.customer_name),
      details: cleanText(body.details),
      due_at: dueAt,
      next_step: cleanText(body.next_step),
      order_number: cleanText(body.order_number),
      owner_name: cleanText(body.owner_name),
      priority,
      status,
      title
    })
    .select()
    .single<JobTicket>();

  if (error) {
    return NextResponse.json({ error: "Unable to create job" }, { status: 500 });
  }

  return NextResponse.json(data);
}
