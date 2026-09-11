"use client";

import { useMemo, useRef, useState } from "react";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
type WorkflowStatus = "discussing" | "inspecting" | "clarifying" | "ready_for_approval" | "ready_to_execute" | "executing" | "verifying";
type CodexAction = "inspect" | "clarify" | "plan" | "execute";

type CodexEvent = {
  action: string;
  message: string;
  response: string;
};

type DelegateResponse = {
  error?: string;
  response?: string;
  status?: WorkflowStatus;
  threadId?: string;
};

function statusLabel(status: WorkflowStatus) {
  const labels: Record<WorkflowStatus, string> = {
    clarifying: "Clarifying",
    discussing: "Discussing",
    executing: "Executing",
    inspecting: "Inspecting",
    ready_for_approval: "Plan ready",
    ready_to_execute: "Approved",
    verifying: "Verifying"
  };

  return labels[status];
}

function extractClientSecret(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as { value?: unknown }).value;
  if (typeof value === "string") return value;
  const nested = (payload as { client_secret?: { value?: unknown } }).client_secret?.value;
  return typeof nested === "string" ? nested : "";
}

export function VoiceCodexWorkspace({ canExecute }: { canExecute: boolean }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("discussing");
  const [threadId, setThreadId] = useState("");
  const [latestIntent, setLatestIntent] = useState("");
  const [spec, setSpec] = useState("");
  const [approvalSummary, setApprovalSummary] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [events, setEvents] = useState<CodexEvent[]>([]);
  const [message, setMessage] = useState("");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);

  const canExecutePlan = canExecute && workflowStatus === "ready_to_execute";
  const latestCodexResponse = events[0]?.response || "Codex has not been called yet.";

  const connectionText = useMemo(() => {
    if (connectionStatus === "connected") return "Live";
    if (connectionStatus === "connecting") return "Connecting";
    if (connectionStatus === "error") return "Needs attention";
    return "Offline";
  }, [connectionStatus]);

  function addTranscript(line: string) {
    setTranscript((current) => [line, ...current].slice(0, 20));
  }

  async function handleFunctionCall(event: { call_id?: string; name?: string; arguments?: string }) {
    if (event.name !== "delegate_to_codex") return;

    let args: { action?: CodexAction; accumulatedContext?: string; approvalSummary?: string; userMessage?: string } = {};

    try {
      args = JSON.parse(event.arguments || "{}");
    } catch {
      args = {};
    }

    const result = await delegateToCodex(args.action || "inspect", {
      accumulatedContext: args.accumulatedContext || spec,
      approvalSummary: args.approvalSummary || approvalSummary,
      userMessage: args.userMessage || latestIntent
    });

    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open" || !event.call_id) return;

    dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: event.call_id,
          output: result.response || result.error || "Codex did not return a response."
        }
      })
    );
    dataChannel.send(JSON.stringify({ type: "response.create" }));
  }

  function handleLiveEvent(rawEvent: MessageEvent<string>) {
    let event: { arguments?: string; call_id?: string; delta?: string; name?: string; text?: string; transcript?: string; type?: string } = {};

    try {
      event = JSON.parse(rawEvent.data);
    } catch {
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      addTranscript(`You: ${event.transcript}`);
      setLatestIntent(event.transcript);
    }

    if (event.type === "response.audio_transcript.done" && event.transcript) {
      addTranscript(`Voice Codex: ${event.transcript}`);
    }

    if (event.type === "response.function_call_arguments.done") {
      void handleFunctionCall(event);
    }
  }

  async function startLive() {
    setConnectionStatus("connecting");
    setMessage("");

    try {
      const sessionResponse = await fetch("/api/voice-codex/live-session", { method: "POST" });
      const sessionPayload = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionPayload.error || "Unable to start GPT Live");
      }

      const clientSecret = extractClientSecret(sessionPayload);
      if (!clientSecret) throw new Error("No GPT Live client secret returned.");

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      microphoneRef.current = microphone;
      microphone.getTracks().forEach((track) => peerConnection.addTrack(track, microphone));

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = handleLiveEvent;
      dataChannel.onopen = () => {
        setConnectionStatus("connected");
        addTranscript("Voice Codex: Live voice session started.");
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const formData = new FormData();
      formData.set("sdp", offer.sdp || "");
      formData.set(
        "session",
        JSON.stringify({
          type: "realtime",
          model: "gpt-live-1"
        })
      );

      const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        body: formData,
        headers: {
          Authorization: `Bearer ${clientSecret}`
        },
        method: "POST"
      });

      if (!realtimeResponse.ok) {
        throw new Error(await realtimeResponse.text());
      }

      await peerConnection.setRemoteDescription({
        sdp: await realtimeResponse.text(),
        type: "answer"
      });
    } catch (error) {
      setConnectionStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start GPT Live");
      stopLive();
    }
  }

  function stopLive() {
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setConnectionStatus("idle");
  }

  async function delegateToCodex(
    action: CodexAction,
    overrides?: { accumulatedContext?: string; approvalSummary?: string; userMessage?: string }
  ) {
    setMessage("");
    setWorkflowStatus(action === "execute" ? "executing" : action === "plan" ? "ready_for_approval" : action === "clarify" ? "clarifying" : "inspecting");

    const userMessage = overrides?.userMessage || latestIntent;
    const accumulatedContext = overrides?.accumulatedContext || spec;
    const approvedSummary = overrides?.approvalSummary || approvalSummary;

    const response = await fetch("/api/voice-codex/delegate", {
      body: JSON.stringify({
        accumulatedContext,
        action,
        approvalSummary: approvedSummary,
        threadId: threadId || undefined,
        userMessage
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json()) as DelegateResponse;

    if (body.threadId) setThreadId(body.threadId);
    if (body.status) setWorkflowStatus(body.status);

    if (!response.ok) {
      setMessage(body.response || body.error || "Codex delegation failed");
      return body;
    }

    const codexResponse = body.response || "Codex returned without a spoken response.";
    setEvents((current) => [{ action, message: userMessage, response: codexResponse }, ...current].slice(0, 12));
    return body;
  }

  async function approvePlan() {
    setMessage("");

    const response = await fetch("/api/voice-codex/delegate", {
      body: JSON.stringify({
        accumulatedContext: spec,
        action: "approve",
        approvalSummary: approvalSummary || spec,
        threadId: threadId || undefined,
        userMessage: "Approved for execution."
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json()) as DelegateResponse;

    if (body.threadId) setThreadId(body.threadId);
    if (body.status) setWorkflowStatus(body.status);
    setMessage(body.response || body.error || "Approval recorded.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">GPT-Live-1</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Voice Codex</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                {connectionText}
              </span>
              <span className="rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                {statusLabel(workflowStatus)}
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {connectionStatus === "connected" || connectionStatus === "connecting" ? (
              <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={stopLive} type="button">
                Stop voice
              </button>
            ) : (
              <button className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" onClick={startLive} type="button">
                Start voice
              </button>
            )}
            <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void delegateToCodex("inspect")} type="button">
              Ask Codex to inspect
            </button>
            <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void delegateToCodex("plan")} type="button">
              Ask for plan
            </button>
          </div>

          {message ? <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
        </div>

        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">
            Latest intent
            <textarea
              className="mt-2 w-full rounded-lg px-4 py-3"
              onChange={(event) => setLatestIntent(event.target.value)}
              placeholder="What should Codex inspect or plan from the repo?"
              value={latestIntent}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Canonical spec
            <textarea
              className="mt-2 min-h-48 w-full rounded-lg px-4 py-3"
              onChange={(event) => setSpec(event.target.value)}
              placeholder="The durable spec built from the conversation. This is what Codex receives with each deliberate delegation."
              value={spec}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void delegateToCodex("clarify")} type="button">
              Send answers
            </button>
            <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void delegateToCodex("plan")} type="button">
              Freeze plan
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">
            Approval summary
            <textarea
              className="mt-2 w-full rounded-lg px-4 py-3"
              onChange={(event) => setApprovalSummary(event.target.value)}
              placeholder="The exact plan being approved. Execution is blocked until approval is recorded."
              value={approvalSummary}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canExecute || (!approvalSummary && !spec)}
              onClick={approvePlan}
              type="button"
            >
              Approve plan
            </button>
            <button
              className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={!canExecutePlan}
              onClick={() => void delegateToCodex("execute")}
              type="button"
            >
              Execute approved work
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Current thread</p>
          <p className="mt-2 break-all text-sm font-medium text-slate-700">{threadId || "Created when Codex is first called"}</p>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Latest Codex response</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{latestCodexResponse}</p>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Live transcript</p>
          <div className="mt-3 max-h-72 space-y-3 overflow-auto">
            {transcript.length > 0 ? (
              transcript.map((line, index) => (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700" key={`${line}-${index}`}>
                  {line}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">Start voice to capture the conversation here.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Codex calls</p>
          <div className="mt-3 space-y-3">
            {events.length > 0 ? (
              events.map((event, index) => (
                <div className="rounded-lg border border-line bg-white p-3" key={`${event.action}-${index}`}>
                  <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">{event.action}</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{event.message}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{event.response}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No Codex calls yet.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
