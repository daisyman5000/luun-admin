import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { convertToCad, getCadRates } from "@/lib/currency";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

type DashboardMetrics = {
  averageDailyModules: number;
  averageModuleValue: number;
  capitalVelocityTurns: number | null;
  cashBalance: number;
  cashConversionCycleDays: number | null;
  customerAcquisitionCost: number | null;
  deployableCash: number | null;
  historicalDays: number;
  inboundPieces: number;
  inventoryValue: number;
  openContainerPayables: number;
  orderCount: number;
  revenue: number;
  selectedMetaSpend: number;
  soldModules: number;
  totalPiecesToConvert: number;
  vancouverOnHand: number;
};

const historyOptions = [
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" }
];

function getHistoryDays(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const days = Number(rawValue || 90);
  return historyOptions.some((option) => option.days === days) ? days : 90;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function nullableMoney(value: number | null) {
  return value === null ? "Unavailable" : money(value);
}

function getRecentOrders(orders: ShopifyOrder[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
  });
}

function isInHistoryWindow(date: string, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const parsedDate = new Date(date);

  return !Number.isNaN(parsedDate.getTime()) && parsedDate >= cutoff;
}

function totalContainerPieces(container: ContainerEntry) {
  return (container.manifest_json || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function calculateDashboardMetrics({
  containers,
  historicalDays,
  metaExpenses,
  openContainerPayablesCad,
  orders,
  vancouverOnHand,
  wiseCash
}: {
  containers: ContainerEntry[];
  historicalDays: number;
  metaExpenses: { amount: number; currency: string; date: string }[];
  openContainerPayablesCad: number | null;
  orders: ShopifyOrder[];
  vancouverOnHand: number;
  wiseCash: number;
}): DashboardMetrics {
  const activeContainers = containers.filter((container) => container.status !== "closed");
  const inboundPieces = activeContainers.reduce((sum, container) => sum + totalContainerPieces(container), 0);
  const recentOrders = getRecentOrders(orders, historicalDays);
  const soldModules = recentOrders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const revenue = recentOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const allModules = orders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const allRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const averageDailyModules = soldModules / historicalDays;
  const averageModuleValue = soldModules > 0 ? revenue / soldModules : allModules > 0 ? allRevenue / allModules : 0;
  const totalPiecesToConvert = vancouverOnHand + inboundPieces;
  const openContainerPayables = openContainerPayablesCad || 0;
  const selectedMetaSpend = metaExpenses
    .filter((expense) => expense.currency === "CAD" && isInHistoryWindow(expense.date, historicalDays))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const cashConversionCycleDays = totalPiecesToConvert > 0 && averageDailyModules > 0
    ? totalPiecesToConvert / averageDailyModules
    : null;
  const capitalVelocityTurns = cashConversionCycleDays && cashConversionCycleDays > 0
    ? 365 / cashConversionCycleDays
    : null;

  return {
    averageDailyModules,
    averageModuleValue,
    capitalVelocityTurns,
    cashBalance: wiseCash,
    cashConversionCycleDays,
    customerAcquisitionCost: recentOrders.length > 0 && selectedMetaSpend > 0 ? selectedMetaSpend / recentOrders.length : null,
    deployableCash: openContainerPayablesCad === null ? null : wiseCash - openContainerPayables,
    historicalDays,
    inboundPieces,
    inventoryValue: totalPiecesToConvert * averageModuleValue,
    openContainerPayables,
    orderCount: recentOrders.length,
    revenue,
    selectedMetaSpend,
    soldModules,
    totalPiecesToConvert,
    vancouverOnHand
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
    <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
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

function turnsLabel(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(1)}x`;
}

function DashboardPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <section className="rounded-[32px] border border-blue-100 bg-blue-50 p-6 shadow-sm lg:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Cash dashboard</p>
        </div>
        <HistorySelector activeDays={metrics.historicalDays} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vancouver on hand" note="Current sellable pieces" value={metrics.vancouverOnHand} />
        <StatCard label="Inbound containers" note="Active container manifest pieces" value={metrics.inboundPieces} />
        <StatCard label="Sales velocity" note="Modules per day" value={metrics.averageDailyModules.toFixed(1)} />
        <StatCard
          label="Deployable cash"
          note="Wise CAD cash minus container payables converted to CAD"
          value={nullableMoney(metrics.deployableCash)}
        />
        <StatCard
          label="Capital Velocity"
          note="365 divided by CCC"
          value={turnsLabel(metrics.capitalVelocityTurns)}
        />
        <StatCard
          label="Cost to acquire customer"
          note={`${money(metrics.selectedMetaSpend)} Meta spend / ${metrics.orderCount} Shopify orders`}
          value={metrics.customerAcquisitionCost === null ? "Unavailable" : money(metrics.customerAcquisitionCost)}
        />
        <StatCard label="Inventory value" note={`${metrics.totalPiecesToConvert} total pieces x average module value`} value={money(metrics.inventoryValue)} />
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
  const { data: inventoryRows, error } = await supabase
    .from("inventory")
    .select("available_qty")
    .returns<Pick<InventoryRow, "available_qty">[]>();
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("created_at,total_modules,total_price")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<ShopifyOrder[]>();
  const { data: containers } = await supabase
    .from("container_entries")
    .select("amount_to_be_paid,amount_currency,manifest_json,status")
    .returns<ContainerEntry[]>();
  const wiseSummary = await getWiseSummary();
  const cadRates = await getCadRates((containers || []).map((container) => container.amount_currency || "USD"));
  const convertedPayables = (containers || [])
    .filter((container) => container.status !== "closed")
    .map((container) => convertToCad(Number(container.amount_to_be_paid || 0), container.amount_currency || "USD", cadRates));
  const openContainerPayablesCad = convertedPayables.some((amount) => amount === null)
    ? null
    : convertedPayables.reduce<number>((sum, amount) => sum + (amount || 0), 0);

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const cadCash = wiseSummary.balances
    .filter((balance) => balance.currency === "CAD")
    .reduce((sum, balance) => sum + balance.amount, 0);
  const metrics = calculateDashboardMetrics({
    containers: containers || [],
    historicalDays,
    metaExpenses: wiseSummary.metaSpend.expenses,
    openContainerPayablesCad,
    orders: orders || [],
    vancouverOnHand,
    wiseCash: cadCash
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      {error ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load the cash conversion cycle.
        </section>
      ) : (
        <DashboardPanel metrics={metrics} />
      )}
    </main>
  );
}
