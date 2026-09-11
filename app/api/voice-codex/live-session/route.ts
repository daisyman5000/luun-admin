import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { voiceCodexLiveInstructions } from "@/lib/voice-codex/prompts";

export const runtime = "nodejs";

export async function POST() {
  const { user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600
      },
      session: {
        type: "realtime",
        model: "gpt-realtime",
        instructions: voiceCodexLiveInstructions,
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-transcribe"
            }
          },
          output: {
            voice: "verse"
          }
        },
        tools: [
          {
            type: "function",
            name: "delegate_to_codex",
            description:
              "Call the persistent Codex worker only for repo inspection, code-dependent clarification, planning, or explicitly approved execution.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                action: {
                  type: "string",
                  enum: ["inspect", "clarify", "plan", "execute"]
                },
                accumulatedContext: {
                  type: "string",
                  description: "The user's accumulated verbal answers and the current canonical spec."
                },
                approvalSummary: {
                  type: "string",
                  description: "Only include when the user explicitly approved execution."
                },
                userMessage: {
                  type: "string",
                  description: "The latest user intent that requires Codex."
                }
              },
              required: ["action", "accumulatedContext", "userMessage"]
            }
          }
        ]
      }
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  const body = await response.json().catch(async () => ({ error: await response.text() }));

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to create GPT Live session", details: body },
      { status: response.status }
    );
  }

  return NextResponse.json(body);
}
