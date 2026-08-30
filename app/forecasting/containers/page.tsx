import { ContainerEntryTable } from "@/components/container-entry-table";
import { MajorExpenseTable } from "@/components/major-expense-table";
import { WayflyerPaymentTable } from "@/components/wayflyer-payment-table";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import type { ContainerEntry, MajorExpense, WayflyerPayment } from "@/lib/types";

export default async function ContainersPage() {
  const { profile, supabase } = await requireUser();
  const canEdit = canUpdateOrderLogistics(profile?.role);
  const [
    { data: containers, error: containersError },
    { data: majorExpenses, error: majorExpensesError },
    { data: wayflyerPayments, error: wayflyerPaymentsError }
  ] = await Promise.all([
    supabase
      .from("container_entries")
      .select("*")
      .order("eta", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<ContainerEntry[]>(),
    supabase
      .from("major_expenses")
      .select("*")
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<MajorExpense[]>(),
    supabase
      .from("wayflyer_payments")
      .select("*")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<WayflyerPayment[]>()
  ]);

  return (
    <main className="px-4 py-4 sm:px-6 lg:px-8">
      <section className="min-h-[calc(100vh-32px)] rounded-[28px] bg-[#f7f8fb] p-4 text-slate-950 sm:p-6 lg:p-8">
        <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Forecasting</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Invoices</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            Track container payments and other major invoices so Demand can gauge cashflow.
          </p>
        </header>

        <div className="space-y-5">
          {wayflyerPaymentsError ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              Wayflyer payments are not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </div>
          ) : (
            <WayflyerPaymentTable canEdit={canEdit} payments={wayflyerPayments || []} />
          )}

          {majorExpensesError ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              Major invoices are not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </div>
          ) : (
            <MajorExpenseTable canEdit={canEdit} expenses={majorExpenses || []} />
          )}

          {containersError ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              The Containers table is not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </div>
          ) : (
            <ContainerEntryTable canEdit={canEdit} containers={containers || []} />
          )}
        </div>
      </section>
    </main>
  );
}
