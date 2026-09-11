import { VoiceCodexWorkspace } from "@/components/voice-codex-workspace";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VoiceCodexPage() {
  const { profile } = await requireUser();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Voice workflow</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Voice Codex</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Talk through a change in GPT-Live-1, call Codex only when the repo matters, then approve the exact plan before execution.
        </p>
      </div>
      <VoiceCodexWorkspace canExecute={canUpdateOrderLogistics(profile?.role)} />
    </main>
  );
}
