import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { voiceCodexLiveInstructions } from "@/lib/voice-codex/prompts";

export const runtime = "nodejs";

const voices = [
  "alloy",
  "ash",
  "ballad",
  "beacon",
  "bossa",
  "cedar",
  "cinder",
  "coral",
  "delta",
  "echo",
  "gleam",
  "marin",
  "meridian",
  "quartz",
  "ripple",
  "sage",
  "shimmer",
  "stone",
  "tempo",
  "verse",
  "vesper",
  "willow"
] as const;

function cleanVoice(value: unknown) {
  return typeof value === "string" && voices.includes(value as (typeof voices)[number]) ? value : "marin";
}

function cleanInstructions(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1200);
}

export async function POST(request: Request) {
  const { user } = await getUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const requestBody = await request.json().catch(() => ({}));
  const voice = cleanVoice((requestBody as { voice?: unknown }).voice);
  const customInstructions = cleanInstructions((requestBody as { instructions?: unknown }).instructions);
  const sdp = typeof (requestBody as { sdp?: unknown }).sdp === "string" ? (requestBody as { sdp: string }).sdp : "";

  if (!sdp) {
    return NextResponse.json({ error: "WebRTC SDP offer is required" }, { status: 400 });
  }

  const instructions = customInstructions
    ? `${voiceCodexLiveInstructions}\n\nVoice personalization:\n${customInstructions}`
    : voiceCodexLiveInstructions;

  const response = await fetch("https://api.openai.com/v1/live/sessions", {
    body: JSON.stringify({
      session: {
        model: "gpt-live-1",
        instructions,
        audio: {
          output: {
            voice
          }
        },
        delegation: {
          type: "client"
        },
        store: true
      },
      transport: {
        type: "webrtc",
        sdp
      }
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
      { error: "Unable to create GPT-Live-1 session", details: responseBody },
      { status: response.status }
    );
  }

  return NextResponse.json(responseBody);
}
