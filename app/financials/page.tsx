import { canViewFinancials, requireUser } from "@/lib/auth";
import { getWiseSummary, type WiseBalanceSummary } from "@/lib/wise/client";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function getCombinedBalances(balances: WiseBalanceSummary[]) {
  const totals = new Map<string, number>();

  for (const balance of balances) {
    totals.set(balance.currency, (totals.get(balance.currency) || 0) + balance.amount);
  }

  return Array.from(totals.entries()).map(([currency, amount]) => ({
    amount,
    currency
  }));
}

function CombinedCash({ balances }: { balances: WiseBalanceSummary[] }) {
  const combinedBalances = getCombinedBalances(balances);

  if (combinedBalances.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Total Wise cash</p>
      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        {combinedBalances.map((balance) => (
          <div key={balance.currency}>
            <p className="text-5xl font-semibold tracking-normal text-slate-950">
              {money(balance.amount, balance.currency)}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Combined {balance.currency} balance across Wise accounts
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BalanceCards({ balances }: { balances: WiseBalanceSummary[] }) {
  if (balances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-slate-50 p-6 text-sm text-slate-600">
        No Wise balances returned yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {balances.map((balance) => (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm" key={balance.id}>
          <p className="text-sm font-medium text-slate-500">{balance.name}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-blue-700">
            {balance.profileType} · {balance.profileName}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-900">
            {money(balance.amount, balance.currency)}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{balance.type}</p>
        </div>
      ))}
    </div>
  );
}

export default async function FinancialsPage() {
  const { profile } = await requireUser();

  if (!canViewFinancials(profile?.role)) {
    return (
      <main className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Financials</h1>
          <p className="mt-2 text-sm text-slate-600">Only owner/admin users can view financial data.</p>
        </div>
      </main>
    );
  }

  const summary = await getWiseSummary();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Wise</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Financials</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Wise cash balances for cashflow review.
        </p>
      </div>

      {!summary.configured ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Wise is not connected yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add `WISE_API_TOKEN` in Vercel to show Wise cash balances here.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {summary.errors.length > 0 ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {summary.errors.join(" ")}
            </section>
          ) : null}
          <CombinedCash balances={summary.balances} />
          <BalanceCards balances={summary.balances} />
        </div>
      )}
    </main>
  );
}
