import { createHash, timingSafeEqual } from "node:crypto";

export const LUUN_WEBFLOW_SITE = "69e6ae9e768a250ec35df199";

export function validInquiryToken(provided: string | null, expected: string | undefined) {
  if (!expected || expected.length < 32 || !provided || provided.length !== expected.length) return false;
  const received = Buffer.from(provided);
  const saved = Buffer.from(expected);
  return received.length === saved.length && timingSafeEqual(received, saved);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function inquiryFromWebflow(event: unknown) {
  const envelope = record(event);
  const payload = record(envelope.payload);
  if (envelope.triggerType !== "form_submission" || payload.siteId !== LUUN_WEBFLOW_SITE) {
    throw new Error("Unexpected Webflow event");
  }
  const submissionId = text(payload.id);
  if (!submissionId || submissionId.length > 100) throw new Error("Submission ID is required");
  const fields = new Map(Object.entries(record(payload.data)).map(([key, value]) =>
    [key.toLowerCase().replace(/[^a-z0-9]/g, ""), text(value)]));
  const field = (...names: string[]) => names.map(name => fields.get(name)).find(Boolean) || "";
  const message = field("message", "yourmessage", "inquiry", "comments", "question");
  // Newsletter signups and other forms without an inquiry stay in Webflow.
  if (!message) return null;
  if (message.length > 30000) throw new Error("Message is too long");
  const email = field("email", "emailaddress", "youremail", "email2");
  const name = field("name", "fullname", "yourname") ||
    [field("firstname"), field("lastname")].filter(Boolean).join(" ");
  const form = text(payload.name) || "Webflow form";
  const page = field("pageurl", "page", "url");
  const source = field("source");
  const submittedAt = text(payload.submittedAt);
  if (!submittedAt || !Number.isFinite(Date.parse(submittedAt))) throw new Error("Submission date is required");
  const hash = createHash("sha256").update(`luun-webflow-inquiry:${payload.siteId}:${submissionId}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x80;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const metadata = [
    `Form: ${form}`, page && `Page: ${page}`, source && `Source: ${source}`,
    `Webflow submission: ${submissionId}`
  ].filter(Boolean).join("\n");
  return {
    id,
    category: "customer_inquiry" as const,
    status: "open" as const,
    priority: "normal" as const,
    title: (field("subject", "topic") || `Inquiry from ${name || email || "website visitor"}`).slice(0, 160),
    customer_name: name.slice(0, 300) || null,
    customer_email: email.slice(0, 320) || null,
    details: `${message}\n\n— Webflow inquiry —\n${metadata}`,
    created_at: new Date(submittedAt).toISOString()
  };
}
