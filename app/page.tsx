import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FeedPost = {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  handle: string;
  initials: string;
  metric?: string;
  status: string;
  title: string;
};

function hasEnv(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function FeedItem({ post }: { post: FeedPost }) {
  return (
    <article className="border-b border-line bg-white px-4 py-5 sm:px-5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {post.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-slate-950">{post.title}</span>
            <span className="text-slate-500">{post.handle}</span>
            <span className="text-slate-300">.</span>
            <span className="font-medium text-slate-500">{post.status}</span>
          </div>
          <p className="mt-2 text-[15px] leading-6 text-slate-800">{post.body}</p>
          {post.metric ? (
            <div className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {post.metric}
            </div>
          ) : null}
          {post.actionHref && post.actionLabel ? (
            <Link
              className="mt-3 inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

export default async function HomePage() {
  await requireUser();

  const grokbotReady = hasEnv("grokbot", "GROKBOT", "GROKBOT_API_KEY", "GROKBOT_TOKEN", "GROKBOT_URL", "GROK_API_KEY", "XAI_API_KEY");
  const posts: FeedPost[] = [
    {
      actionHref: "/voice-codex",
      actionLabel: "Open voice",
      body: "Talk through changes, collect the messy context, and hand Codex a clean task only when the repo actually needs to be inspected or changed.",
      handle: "@voicecodex",
      initials: "VC",
      status: "ready",
      title: "Voice Codex"
    },
    {
      body: grokbotReady
        ? "Grokbot is available to the app through a server-side environment variable. The key is not shown in the browser."
        : "Grokbot is not showing a recognized server-side environment variable in this deployment yet.",
      handle: "@grokbot",
      initials: "G",
      metric: grokbotReady ? "Connection: server env found" : "Connection: env missing",
      status: grokbotReady ? "connected" : "offline",
      title: "Grokbot"
    },
    {
      actionHref: "/demand",
      actionLabel: "Open demand",
      body: "Demand is reading Vancouver inventory, adding container ETAs by month, subtracting sale windows, and carrying negative inventory into the next month.",
      handle: "@demand",
      initials: "D",
      status: "working",
      title: "Demand Plan"
    },
    {
      actionHref: "/forecasting/containers",
      actionLabel: "Open invoices",
      body: "Invoices are where container entries and manifests live. Those container pieces become incoming inventory for the demand plan.",
      handle: "@invoices",
      initials: "IN",
      status: "working",
      title: "Invoices"
    },
    {
      actionHref: "/inventory",
      actionLabel: "Open inventory",
      body: "Inventory is the Vancouver on-hand source. Demand uses this as the starting point before containers and sale windows are applied.",
      handle: "@inventory",
      initials: "I",
      status: "working",
      title: "Inventory"
    }
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl border-x border-line bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-5 lg:top-0">
        <h1 className="text-xl font-semibold tracking-normal text-slate-950">Home</h1>
      </header>

      <section className="border-b border-line bg-white px-4 py-4 sm:px-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
            L
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg text-slate-500">What are the agents working on?</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <Link className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" href="/voice-codex">
                Ask Voice Codex
              </Link>
              <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700" href="/demand">
                Demand
              </Link>
              <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700" href="/forecasting/containers">
                Invoices
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section>
        {posts.map((post) => (
          <FeedItem key={post.handle} post={post} />
        ))}
      </section>
    </main>
  );
}
