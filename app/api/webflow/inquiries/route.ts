import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inquiryFromWebflow, validInquiryToken } from "@/lib/webflow-inquiries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!process.env.WEBFLOW_INQUIRY_TOKEN) {
    return NextResponse.json({ error: "Inquiry integration is not configured" }, { status: 503 });
  }
  if (!validInquiryToken(token, process.env.WEBFLOW_INQUIRY_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 65536) {
    return NextResponse.json({ error: "Submission too large" }, { status: 413 });
  }
  let inquiry;
  try {
    inquiry = inquiryFromWebflow(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid form submission" }, { status: 400 });
  }
  if (!inquiry) return NextResponse.json({ received: true, skipped: true });
  try {
    // A retry must never duplicate a ticket or reopen a resolved inquiry.
    const { error } = await createAdminClient().from("job_tickets")
      .upsert(inquiry, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch {
    // Return failure so Webflow retries; never acknowledge before persistence.
    return NextResponse.json({ error: "Unable to save inquiry" }, { status: 503 });
  }
}
