import { requireUser } from "@/lib/auth";

export async function ComingSoonPage({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  await requireUser();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Coming later</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>

      <section className="mt-8 rounded-xl border border-dashed border-line bg-white/70 p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          This section is intentionally empty for now. The navigation is ready, but the feature has
          not been built yet.
        </p>
      </section>
    </main>
  );
}
