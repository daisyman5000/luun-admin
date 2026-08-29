import { JobsBoard } from "@/components/jobs-board";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import type { JobTicket } from "@/lib/types";

export default async function JobsPage() {
  const { profile, supabase } = await requireUser();
  const canEdit = canUpdateOrderLogistics(profile?.role);
  const { data, error } = await supabase
    .from("job_tickets")
    .select("*")
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<JobTicket[]>();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Jobs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
          Job system
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Customer messages, ads, followups, reviews, social posts, and technology improvements in one queue.
        </p>
      </div>

      {error ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          The Jobs table is not ready in Supabase yet. Apply the latest database migration, then refresh this page.
        </section>
      ) : (
        <JobsBoard canEdit={canEdit} jobs={data || []} />
      )}
    </main>
  );
}
