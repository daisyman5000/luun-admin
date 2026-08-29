import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ShopifyOrder } from "@/lib/types";

type MonthOption = {
  end: Date;
  href: string;
  isActive: boolean;
  label: string;
  month: string;
  start: Date;
};

type DailyCac = {
  cac: number | null;
  date: Date;
  key: string;
  metaSpend: number;
  orderCount: number;
  revenue: number;
};

type Summary = {
  cac: number | null;
  label: string;
  metaSpend: number;
  orderCount: number;
  revenue: number;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);
  return { end, start };
}

function getMonthOptions(selectedMonthValue?: string | string[]) {
  const rawMonth = Array.isArray(selectedMonthValue) ? selectedMonthValue[0] : selectedMonthValue;
  const today = new Date();
  const selectedMonth = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : monthKey(today);

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const month = monthKey(date);
    const { end, start } = monthBounds(month);

    return {
      end,
      href: `/cac?month=${month}`,
      isActive: month === selectedMonth,
      label: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date),
      month,
      start
    };
  });
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function cacLabel(value: number | null) {
  return value === null ? "Unavailable" : money(value);
}

function buildDailyCac({
  metaExpenses,
  month,
  orders
}: {
  metaExpenses: { amount: number; currency: string; date: string }[];
  month: MonthOption;
  orders: ShopifyOrder[];
}) {
  const daysInMonth = month.end.getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(month.start.getFullYear(), month.start.getMonth(), index + 1);
    const key = dateKey(date);
    const dayOrders = orders.filter((order) => dateKey(new Date(order.created_at)) === key);
    const metaSpend = metaExpenses
      .filter((expense) => expense.currency === "CAD" && dateKey(new Date(expense.date)) === key)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

    return {
      cac: dayOrders.length > 0 && metaSpend > 0 ? metaSpend / dayOrders.length : null,
      date,
      key,
      metaSpend,
      orderCount: dayOrders.length,
      revenue
    };
  });
}

function summarize(label: string, rows: DailyCac[]): Summary {
  const metaSpend = rows.reduce((sum, row) => sum + row.metaSpend, 0);
  const orderCount = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    cac: orderCount > 0 && metaSpend > 0 ? metaSpend / orderCount : null,
    label,
    metaSpend,
    orderCount,
    revenue
  };
}

function buildWeeklySummaries(rows: DailyCac[]) {
  const weeks = new Map<string, DailyCac[]>();

  for (const row of rows) {
    const weekStart = new Date(row.date);
    weekStart.setDate(row.date.getDate() - row.date.getDay());
    const key = dateKey(weekStart);
    weeks.set(key, [...(weeks.get(key) || []), row]);
  }

  return Array.from(weeks.entries()).map(([key, weekRows]) =>
    summarize(`Week of ${formatDate(new Date(key))}`, weekRows)
  );
}

function buildSaleSummaries(rows: DailyCac[]) {
  const activeRows = rows.filter((row) => row.metaSpend > 0 || row.orderCount > 0);
  const periods: DailyCac[][] = [];

  for (const row of activeRows) {
    const currentPeriod = periods.at(-1);
    const previousRow = currentPeriod?.at(-1);

    if (!currentPeriod || !previousRow || row.date.getTime() - previousRow.date.getTime() > 86_400_000) {
      periods.push([row]);
    } else {
      currentPeriod.push(row);
    }
  }

  return periods.map((period) => {
    const first = period[0];
    const last = period[period.length - 1];
    const label = first.key === last.key
      ? formatDate(first.date)
      : `${formatDate(first.date)} to ${formatDate(last.date)}`;
    return summarize(label, period);
  });
}

function MonthSelector({ options }: { options: MonthOption[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          className={[
            "rounded-full border px-4 py-2 text-sm font-semibold transition",
            option.isActive
              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
              : "border-blue-100 bg-white/80 text-blue-700 hover:bg-blue-50"
          ].join(" ")}
          href={option.href}
          key={option.month}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function SummaryTable({ rows, title }: { rows: Summary[]; title: string }) {
  return (
    <section className="rounded-[28px] border border-line bg-white shadow-sm">
      <div className="border-b border-line p-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {["Period", "Meta spend", "Orders", "CAC", "Revenue"].map((heading) => (
                <th className="px-4 py-3 text-left" key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>No activity in this month.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr className="border-t border-line" key={row.label}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.label}</td>
                  <td className="px-4 py-4">{money(row.metaSpend)}</td>
                  <td className="px-4 py-4">{row.orderCount}</td>
                  <td className="px-4 py-4 font-semibold">{cacLabel(row.cac)}</td>
                  <td className="px-4 py-4">{money(row.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DailyTable({ rows }: { rows: DailyCac[] }) {
  return (
    <section className="rounded-[28px] border border-line bg-white shadow-sm">
      <div className="border-b border-line p-5">
        <h2 className="text-lg font-semibold text-slate-950">Daily CAC</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {["Day", "Meta spend", "Orders", "CAC", "Revenue"].map((heading) => (
                <th className="px-4 py-3 text-left" key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-line" key={row.key}>
                <td className="px-4 py-4 font-semibold text-slate-950">{formatDate(row.date)}</td>
                <td className="px-4 py-4">{money(row.metaSpend)}</td>
                <td className="px-4 py-4">{row.orderCount}</td>
                <td className="px-4 py-4 font-semibold">{cacLabel(row.cac)}</td>
                <td className="px-4 py-4">{money(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CacPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthOptions = getMonthOptions(resolvedSearchParams?.month);
  const selectedMonth = monthOptions.find((option) => option.isActive) || monthOptions[0];
  const { supabase } = await requireUser();
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("created_at,total_price")
    .gte("created_at", selectedMonth.start.toISOString())
    .lte("created_at", selectedMonth.end.toISOString())
    .order("created_at", { ascending: true })
    .returns<ShopifyOrder[]>();
  const wiseSummary = await getWiseSummary();
  const dailyRows = buildDailyCac({
    metaExpenses: wiseSummary.metaSpend.expenses,
    month: selectedMonth,
    orders: orders || []
  });
  const monthSummary = summarize(selectedMonth.label, dailyRows);
  const weeklyRows = buildWeeklySummaries(dailyRows);
  const saleRows = buildSaleSummaries(dailyRows);

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">CAC</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            CAC over time
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Daily, weekly, monthly, and sale-period CAC from live Wise Meta spend and Shopify orders.
          </p>
        </div>
        <MonthSelector options={monthOptions} />
      </div>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly CAC" value={cacLabel(monthSummary.cac)} />
        <StatCard label="Meta spend" value={money(monthSummary.metaSpend)} />
        <StatCard label="Orders" value={monthSummary.orderCount} />
        <StatCard label="Revenue" value={money(monthSummary.revenue)} />
      </section>

      <div className="space-y-5">
        <DailyTable rows={dailyRows} />
        <SummaryTable rows={weeklyRows} title="Weekly CAC" />
        <SummaryTable rows={saleRows} title="Detected sale periods" />
      </div>
    </main>
  );
}
