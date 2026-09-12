import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AgentPost = {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  label: string;
  meta: string;
  status: "active" | "ready" | "offline";
  title: string;
};

function hasEnv(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function statusClasses(status: AgentPost["status"]) {
  if (status === "active") return "border-green-200 bg-green-50 text-green-700";
  if (status === "ready") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-line bg-slate-50 text-slate-500";
}

function AgentPostCard({ post }: { post: AgentPost }) {
  return (
    <article className="border-b border-line bg-white px-5 py-5 transition hover:bg-slate-50 sm:px-6">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
          {post.label}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">{post.title}</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(post.status)}`}>
              {post.meta}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{post.body}</p>
          {post.actionHref && post.actionLabel ? (
            <Link
              className="mt-4 inline-flex rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href={post.actionHref}
            >
              {post.actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function TimelinePage() {
  await requireUser();

  const grokbotReady = hasEnv("grokbot", "GROKBOT", "GROKBOT_API_KEY", "GROKBOT_TOKEN", "GROKBOT_URL", "GROK_API_KEY", "XAI_API_KEY");
  const posts: AgentPost[] = [
    {
      actionHref: "/voice-codex",
      actionLabel: "Open Voice Codex",
      body: "Voice Codex is the live voice agent for talking through repo changes before Codex plans or edits code.",
      label: "VC",
      meta: "Ready",
      status: "ready",
      title: "Voice Codex"
    },
    {
      body: grokbotReady
        ? "Grokbot has a server-side environment variable configured. Its secret stays on the backend."
        : "Grokbot is listed, but this deployment has not exposed a recognized server-side env var to the app yet.",
      label: "G",
      meta: grokbotReady ? "Connected" : "Env missing",
      status: grokbotReady ? "active" : "offline",
      title: "Grokbot"
    },
    {
      actionHref: "/demand",
      actionLabel: "Open Demand",
      body: "Demand planning is using inventory, container ETAs, sale windows, ad spend, and month-to-month carry-forward.",
      label: "D",
      meta: "Working",
      status: "active",
      title: "Demand Agent"
    },
    {
      actionHref: "/forecasting/containers",
      actionLabel: "Open Invoices",
      body: "Invoice and container entries feed the inventory and demand timeline through each container manifest and ETA.",
      label: "IN",
      meta: "Working",
      status: "active",
      title: "Invoice Agent"
    },
    {
      actionHref: "/inventory",
      actionLabel: "Open Inventory",
      body: "Inventory is the Vancouver stock source. Demand starts from this before adding monthly incoming containers.",
      label: "I",
      meta: "Working",
      status: "active",
      title: "Inventory Agent"
    }
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-line bg-white shadow-sm">
        <div className="border-b border-line px-5 py-5 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Timeline</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Agents</h1>
        </div>
        <div>
          {posts.map((post) => (
            <AgentPostCard key={post.title} post={post} />
          ))}
        </div>
      </section>
    </main>
  );
}
