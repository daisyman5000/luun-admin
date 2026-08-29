import { canViewFinancials, requireUser } from "@/lib/auth";
import { getWiseSummary, type WiseBalanceSummary, type WiseMetaSpendSummary } from "@/lib/wise/client";

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

function formatDate(value?: string | null) {
  if (!value) return "Not detected";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
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

function MetaSpendPanel({ metaSpend }: { metaSpend: WiseMetaSpendSummary }) {
  const monthlyBaseline = metaSpend.totals.map((total) => ({
    amount: (total.amount / metaSpend.lookbackDays) * 30,
    currency: total.currency
  }));

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Meta ads</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Wise Meta expense baseline</h2>
        <p className="mt-1 text-sm text-slate-500">
          Filtered from Wise descriptions containing Meta, Facebook, FB Ads, or Instagram.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Total detected</p>
          <div className="mt-3 space-y-1">
            {metaSpend.totals.length > 0 ? (
              metaSpend.totals.map((total) => (
                <p className="text-2xl font-semibold text-slate-950" key={total.currency}>
                  {money(total.amount, total.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-semibold text-slate-950">$0</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Monthly baseline</p>
          <div className="mt-3 space-y-1">
            {monthlyBaseline.length > 0 ? (
              monthlyBaseline.map((total) => (
                <p className="text-2xl font-semibold text-slate-950" key={total.currency}>
                  {money(total.amount, total.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-semibold text-slate-950">$0</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Started</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatDate(metaSpend.firstDetectedAt)}
          </p>
        </div>
      </div>

      {metaSpend.expenses.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line">
          {metaSpend.expenses.slice(-8).reverse().map((expense) => (
            <div className="grid gap-3 border-b border-line p-4 text-sm last:border-b-0 md:grid-cols-[120px_1fr_130px]" key={`${expense.date}-${expense.description}-${expense.amount}`}>
              <span className="font-medium text-slate-600">{formatDate(expense.date)}</span>
              <span>
                <span className="font-semibold text-slate-900">{expense.description}</span>
                <span className="mt-1 block text-xs text-slate-500">{expense.profileName}</span>
              </span>
              <span className="text-right font-semibold text-slate-950">
                {money(expense.amount, expense.currency)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-slate-50 p-4 text-sm text-slate-600">
          No Meta expenses detected in the Wise lookback window.
        </div>
      )}
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
          <MetaSpendPanel metaSpend={summary.metaSpend} />
          <BalanceCards balances={summary.balances} />
        </div>
      )}
    </main>
  );
}
