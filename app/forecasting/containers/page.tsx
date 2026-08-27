import { ContainerEntryTable } from "@/components/container-entry-table";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import type { ContainerEntry } from "@/lib/types";

export default async function ContainersPage() {
  const { profile, supabase } = await requireUser();
  const canEdit = canUpdateOrderLogistics(profile?.role);
  const { data, error } = await supabase
    .from("container_entries")
    .select("*")
    .order("eta", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<ContainerEntry[]>();

  return (
    <main className="px-4 py-4 sm:px-6 lg:px-8">
      <section className="min-h-[calc(100vh-32px)] rounded-[28px] bg-[#f7f8fb] p-4 text-slate-950 sm:p-6 lg:p-8">
        <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Forecasting</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Containers</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            Enter containers, SKUs on board, paid amounts, payment due dates, and ETA.
          </p>
        </header>

        {error ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            The Containers table is not ready in Supabase yet. Apply the latest database migration, then refresh this page.
          </div>
        ) : (
          <ContainerEntryTable canEdit={canEdit} containers={data || []} />
        )}
      </section>
    </main>
  );
}
