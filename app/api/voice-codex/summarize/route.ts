import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";

export const runtime = "nodejs";

type SummaryBody = {
  latestIntent?: string;
  notes?: string;
  transcript?: string[];
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanTranscript(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === "string")
        .slice(0, 40)
        .join("\n")
        .slice(0, 12000)
    : "";
}

function extractTextFromResponse(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const outputText = (body as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") return outputText;
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => (typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const { user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as SummaryBody;
  const latestIntent = cleanString(body.latestIntent, 2000);
  const notes = cleanString(body.notes, 12000);
  const transcript = cleanTranscript(body.transcript);

  if (!latestIntent && !notes && !transcript) {
    return NextResponse.json({ error: "Add transcript or notes before building a Codex prompt" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
      instructions: `
You turn messy spoken product/code instructions into a precise Codex implementation prompt.

Return only the prompt. Make it specific and usable by a coding agent.
Include:
- Goal
- Current concern/problem
- Desired behavior
- Explicit non-goals
- Questions Codex should answer after inspecting the repo
- Approval gate before code writes
Do not invent business rules. Mark unclear items as questions.
`.trim(),
      input: `
Latest intent:
${latestIntent || "None"}

Existing notes/spec:
${notes || "None"}

Transcript:
${transcript || "None"}
`.trim()
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  const responseBody = await response.json().catch(async () => ({ error: await response.text() }));

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to build Codex prompt", details: responseBody },
      { status: response.status }
    );
  }

  return NextResponse.json({ spec: extractTextFromResponse(responseBody).trim() });
}
