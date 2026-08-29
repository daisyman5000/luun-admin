import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

type ModuleTotals = {
  armless: number;
  corner: number;
  ottoman: number;
};

type FabricInventory = {
  fabric: string;
  modules: ModuleTotals;
  total: number;
};

type CashCycle = {
  averageDailyModules: number;
  averageModuleValue: number;
  baselineAdSpend: number;
  cashBalance: number;
  days: number | null;
  historicalDays: number;
  inventoryValue: number;
  openContainerPayables: number;
  orderCount: number;
  revenue: number;
  soldModules: number;
};

const modules: (keyof ModuleTotals)[] = ["corner", "armless", "ottoman"];
const historyOptions = [
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" }
];

function getHistoryDays(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const days = Number(rawValue || 90);
  return historyOptions.some((option) => option.days === days) ? days : 90;
}

function titleCase(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyTotals(): ModuleTotals {
  return {
    armless: 0,
    corner: 0,
    ottoman: 0
  };
}

function summarizeVancouverInventory(rows: InventoryRow[]): FabricInventory[] {
  const byFabric = new Map<string, ModuleTotals>();

  for (const row of rows) {
    const fabric = row.fabric_slug || "unknown";
    const moduleName = row.module_slug;

    if (!moduleName || !modules.includes(moduleName as keyof ModuleTotals)) {
      continue;
    }

    const totals = byFabric.get(fabric) || emptyTotals();
    totals[moduleName as keyof ModuleTotals] += Number(row.available_qty || 0);
    byFabric.set(fabric, totals);
  }

  return Array.from(byFabric.entries())
    .map(([fabric, totals]) => ({
      fabric,
      modules: totals,
      total: modules.reduce((sum, module) => sum + totals[module], 0)
    }))
    .sort((left, right) => left.fabric.localeCompare(right.fabric));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function getRecentOrders(orders: ShopifyOrder[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
  });
}

function calculateCashCycle({
  containers,
  historicalDays,
  metaSpend,
  orders,
  totalPieces,
  wiseCash
}: {
  containers: ContainerEntry[];
  historicalDays: number;
  metaSpend: { amount: number; currency: string }[];
  orders: ShopifyOrder[];
  totalPieces: number;
  wiseCash: number;
}): CashCycle {
  const recentOrders = getRecentOrders(orders, historicalDays);
  const recentModules = recentOrders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const recentRevenue = recentOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const allModules = orders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const allRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const averageDailyModules = recentModules / historicalDays;
  const averageModuleValue = recentModules > 0 ? recentRevenue / recentModules : allModules > 0 ? allRevenue / allModules : 0;

  return {
    averageDailyModules,
    averageModuleValue,
    baselineAdSpend: metaSpend.find((total) => total.currency === "CAD")?.amount ?? 0,
    cashBalance: wiseCash,
    days: averageDailyModules > 0 ? Math.ceil(totalPieces / averageDailyModules) : null,
    historicalDays,
    inventoryValue: totalPieces * averageModuleValue,
    openContainerPayables: containers.reduce((sum, container) => sum + Number(container.amount_to_be_paid || 0), 0),
    orderCount: recentOrders.length,
    revenue: recentRevenue,
    soldModules: recentModules
  };
}

function StatCard({
  label,
  note,
  value
}: {
  label: string;
  note?: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p> : null}
    </div>
  );
}

function HistorySelector({ activeDays }: { activeDays: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {historyOptions.map((option) => {
        const isActive = option.days === activeDays;

        return (
          <Link
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              isActive
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-blue-100 bg-white/80 text-blue-700 hover:bg-blue-50"
            ].join(" ")}
            href={`/?history=${option.days}`}
            key={option.days}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function CashCyclePanel({ cycle }: { cycle: CashCycle }) {
  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Cashflow conversion cycle</p>
          <p className="mt-1 text-sm text-slate-600">Shopify history window: {cycle.historicalDays} days</p>
        </div>
        <HistorySelector activeDays={cycle.historicalDays} />
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="mt-3 text-5xl font-semibold tracking-normal text-slate-950">
            {cycle.days === null ? "Not enough sales data" : `${cycle.days} days`}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Estimated days to convert current Vancouver inventory into cash based on Shopify module sales from the selected history window.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[700px]">
          <StatCard
            label="Sales velocity"
            note="Modules per day"
            value={cycle.averageDailyModules.toFixed(1)}
          />
          <StatCard
            label="Modules sold"
            note={`${cycle.orderCount} Shopify orders`}
            value={cycle.soldModules}
          />
          <StatCard
            label="Revenue in window"
            note="From imported Shopify orders"
            value={money(cycle.revenue)}
          />
          <StatCard
            label="Inventory value"
            note="On-hand pieces x average module value"
            value={money(cycle.inventoryValue)}
          />
          <StatCard
            label="Open container payables"
            note="Amount still to be paid"
            value={money(cycle.openContainerPayables)}
          />
          <StatCard
            label="Meta ad baseline"
            note="Latest detected Wise month"
            value={money(cycle.baselineAdSpend)}
          />
        </div>
      </div>
    </section>
  );
}

function InventoryTable({ rows }: { rows: FabricInventory[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-slate-600">
        No Vancouver on-hand inventory rows are available yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Fabric</th>
            <th className="px-4 py-3 text-right">Corner</th>
            <th className="px-4 py-3 text-right">Armless</th>
            <th className="px-4 py-3 text-right">Ottoman</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line" key={row.fabric}>
              <td className="px-4 py-4 font-semibold text-slate-950">{titleCase(row.fabric)}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.corner}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.armless}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.ottoman}</td>
              <td className="px-4 py-4 text-right text-lg font-semibold text-slate-950">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleMix({ rows }: { rows: FabricInventory[] }) {
  const totals = rows.reduce<ModuleTotals>((summary, row) => {
    for (const moduleName of modules) {
      summary[moduleName] += row.modules[moduleName];
    }
    return summary;
  }, emptyTotals());
  const max = Math.max(...modules.map((module) => totals[module]), 1);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">Module mix</h2>
        <p className="mt-1 text-sm text-slate-500">Actual pieces on hand in Vancouver.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {modules.map((module) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={module}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold capitalize text-slate-800">{module}</span>
              <span className="text-2xl font-semibold text-slate-950">{totals[module]}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.max(8, (totals[module] / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ history?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const historicalDays = getHistoryDays(resolvedSearchParams?.history);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("fabric_slug", { ascending: true })
    .order("module_slug", { ascending: true })
    .returns<InventoryRow[]>();
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("created_at,total_modules,total_price")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<ShopifyOrder[]>();
  const { data: containers } = await supabase
    .from("container_entries")
    .select("amount_to_be_paid")
    .returns<ContainerEntry[]>();
  const wiseSummary = await getWiseSummary();

  const inventoryRows = summarizeVancouverInventory(data || []);
  const totalPieces = inventoryRows.reduce((sum, row) => sum + row.total, 0);
  const cadCash = wiseSummary.balances
    .filter((balance) => balance.currency === "CAD")
    .reduce((sum, balance) => sum + balance.amount, 0);
  const cashCycle = calculateCashCycle({
    containers: containers || [],
    historicalDays,
    metaSpend: wiseSummary.metaSpend.monthlyTotals,
    orders: orders || [],
    totalPieces,
    wiseCash: cadCash
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Luun Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Vancouver inventory</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Real on-hand inventory only. Forecasting, planned sales, fake purchase orders, and fake incoming containers are not shown here.
        </p>
      </div>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load Vancouver inventory.
        </section>
      ) : (
        <div className="space-y-5">
          <CashCyclePanel cycle={cashCycle} />
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total on hand" value={totalPieces} />
            <StatCard label="Fabrics" value={inventoryRows.length} />
            <StatCard label="Wise CAD cash" value={money(cashCycle.cashBalance)} />
            <StatCard
              label="Corner pieces"
              value={inventoryRows.reduce((sum, row) => sum + row.modules.corner, 0)}
            />
            <StatCard
              label="Armless pieces"
              value={inventoryRows.reduce((sum, row) => sum + row.modules.armless, 0)}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <div>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-950">Inventory by fabric</h2>
                <p className="mt-1 text-sm text-slate-500">Available quantity from the Inventory table.</p>
              </div>
              <InventoryTable rows={inventoryRows} />
            </div>
            <ModuleMix rows={inventoryRows} />
          </section>
        </div>
      )}
    </main>
  );
}
