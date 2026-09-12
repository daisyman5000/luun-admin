import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { canUpdateOrderLogistics, getUserContext } from "@/lib/auth";
import { buildVoiceCodexAppDataSnapshot } from "@/lib/voice-codex/app-data";
import { buildCodexPrompt, codexWorkerSystemPrompt } from "@/lib/voice-codex/prompts";

export const runtime = "nodejs";

type DelegationAction = "inspect" | "clarify" | "plan" | "approve" | "execute";

type DelegateBody = {
  accumulatedContext?: string;
  action?: DelegationAction;
  approvalSummary?: string;
  threadId?: string;
  userMessage?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

const persistenceUnavailableMessage =
  "Voice Codex is using a temporary thread. App data lookup still works, but saved thread history needs the production database migration.";

function isTemporaryThreadId(threadId: string) {
  return threadId.startsWith("ephemeral-");
}

function isAction(value: unknown): value is DelegationAction {
  return value === "inspect" || value === "clarify" || value === "plan" || value === "approve" || value === "execute";
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

async function callCodexWorker({
  action,
  accumulatedContext,
  appDataSnapshot,
  approvalSummary,
  threadId,
  userMessage
}: {
  action: DelegationAction;
  accumulatedContext: string;
  appDataSnapshot: string;
  approvalSummary: string;
  threadId: string;
  userMessage: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      response:
        "OpenAI is not configured on this deployment yet. Add OPENAI_API_KEY on the server before starting a live Codex work session."
    };
  }

  const prompt = buildCodexPrompt({ action, accumulatedContext, appDataSnapshot, approvalSummary, userMessage });
  const model = process.env.OPENAI_CODEX_MODEL || "gpt-5.2";

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      model,
      instructions: codexWorkerSystemPrompt,
      input: prompt,
      metadata: {
        luun_voice_codex_thread_id: threadId,
        workflow_action: action
      },
      store: true
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  const body = await response.json().catch(async () => ({ error: await response.text() }));

  if (!response.ok) {
    return {
      response: "Codex could not be reached from the backend.",
      details: body
    };
  }

  return {
    response: extractTextFromResponse(body) || "Codex returned without a spoken response.",
    openaiResponseId: typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : null
  };
}

export async function POST(request: NextRequest) {
  const { profile, supabase, user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as DelegateBody;
  const action = isAction(body.action) ? body.action : null;
  const userMessage = cleanString(body.userMessage);
  const accumulatedContext = cleanString(body.accumulatedContext);
  const approvalSummary = cleanString(body.approvalSummary);

  if (!action) {
    return NextResponse.json({ error: "A valid action is required" }, { status: 400 });
  }

  if (action !== "approve" && !userMessage) {
    return NextResponse.json({ error: "A message for Codex is required" }, { status: 400 });
  }

  if ((action === "approve" || action === "execute") && !canUpdateOrderLogistics(profile?.role)) {
    return NextResponse.json({ error: "Not authorized to approve or execute code work" }, { status: 403 });
  }

  const requestedThreadId = cleanString(body.threadId);
  let threadId = requestedThreadId;
  let persistenceAvailable = Boolean(requestedThreadId) && !isTemporaryThreadId(requestedThreadId);
  let persistenceWarning: string | null = null;

  if (!threadId) {
    const { data, error } = await supabase
      .from("voice_codex_threads")
      .insert({
        accumulated_context: accumulatedContext,
        created_by: user.id,
        status: "discussing",
        title: userMessage.slice(0, 120) || "Voice Codex task"
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) {
      threadId = `ephemeral-${randomUUID()}`;
      persistenceAvailable = false;
      persistenceWarning = persistenceUnavailableMessage;
    } else {
      threadId = data.id;
      persistenceAvailable = true;
    }
  } else if (persistenceAvailable) {
    const { error } = await supabase
      .from("voice_codex_threads")
      .update({
        accumulated_context: accumulatedContext,
        updated_at: new Date().toISOString()
      })
      .eq("id", threadId);

    persistenceAvailable = !error;
    persistenceWarning = error ? persistenceUnavailableMessage : null;
  } else {
    persistenceWarning = persistenceUnavailableMessage;
  }

  const { data: thread } = persistenceAvailable
    ? await supabase
        .from("voice_codex_threads")
        .select("approved_at,status")
        .eq("id", threadId)
        .single<{ approved_at: string | null; status: string }>()
    : { data: null };

  if (action === "approve") {
    if (!persistenceAvailable) {
      return NextResponse.json({
        persistenceWarning,
        response: "Approval recorded for this browser session. Durable Voice Codex storage is not available yet.",
        status: "ready_to_execute",
        threadId
      });
    }

    const { error } = await supabase
      .from("voice_codex_threads")
      .update({
        approval_summary: approvalSummary || accumulatedContext,
        approved_at: new Date().toISOString(),
        status: "ready_to_execute",
        updated_at: new Date().toISOString()
      })
      .eq("id", threadId);

    if (error) {
      return NextResponse.json({ error: "Unable to record approval", detailMessage: errorMessage(error) }, { status: 500 });
    }

    await supabase.from("voice_codex_events").insert({
      action,
      codex_response: "Approval recorded. Execution is now available for this exact plan.",
      created_by: user.id,
      thread_id: threadId,
      user_message: approvalSummary || accumulatedContext
    });

    return NextResponse.json({
      response: "Approval recorded. I can execute this plan now.",
      status: "ready_to_execute",
      threadId
    });
  }

  if (action === "execute" && persistenceAvailable && !thread?.approved_at) {
    return NextResponse.json(
      {
        error: "Execution requires explicit approval first",
        response: "I need explicit approval for the current plan before I can execute."
      },
      { status: 409 }
    );
  }

  if (action === "execute" && !persistenceAvailable && !approvalSummary) {
    return NextResponse.json(
      {
        error: "Execution requires explicit approval first",
        persistenceWarning,
        response: "I need the approved plan in the approval box before I can execute without durable Voice Codex storage."
      },
      { status: 409 }
    );
  }

  const nextStatus =
    action === "execute"
      ? "executing"
      : action === "plan"
        ? "ready_for_approval"
        : action === "clarify"
          ? "clarifying"
          : "inspecting";

  if (persistenceAvailable) {
    await supabase
      .from("voice_codex_threads")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", threadId);
  }

  const result = await callCodexWorker({
    action,
    accumulatedContext,
    appDataSnapshot: await buildVoiceCodexAppDataSnapshot(supabase, profile?.role),
    approvalSummary: approvalSummary || "",
    threadId,
    userMessage
  });

  if (persistenceAvailable) {
    await supabase.from("voice_codex_events").insert({
      action,
      codex_response: result.response,
      created_by: user.id,
      openai_response_id: result.openaiResponseId || null,
      thread_id: threadId,
      user_message: userMessage
    });

    await supabase
      .from("voice_codex_threads")
      .update({
        last_codex_response: result.response,
        status: action === "execute" ? "verifying" : nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", threadId);
  }

  return NextResponse.json({
    ...result,
    persistenceWarning,
    status: action === "execute" ? "verifying" : nextStatus,
    threadId
  });
}
