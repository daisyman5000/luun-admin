import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

type DemandMetrics = {
  averageDailyModules: number;
  averageDailyOrders: number;
  averageModulesPerOrder: number | null;
  currentMetaSpendPerDay: number | null;
  customerAcquisitionCost: number | null;
  historicalDays: number;
  inboundPieces: number;
  nextContainer: ContainerEntry | null;
  nextSaleDate: Date | null;
  orderCount: number;
  selectedMetaSpend: number;
  soldModules: number;
  totalInventoryToSell: number;
  vancouverOnHand: number;
  waitDays: number | null;
};

const saleLeadDays = 21;
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

function getContainerEta(container: ContainerEntry) {
  if (!container.eta) return null;
  const eta = new Date(`${container.eta}T00:00:00`);
  return Number.isNaN(eta.getTime()) ? null : eta;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function daysBetween(start: Date, end: Date) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDay.getTime() - startDay.getTime()) / 86_400_000);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(date: Date | null) {
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function calculateDemandMetrics({
  containers,
  historicalDays,
  metaExpenses,
  orders,
  vancouverOnHand
}: {
  containers: ContainerEntry[];
  historicalDays: number;
  metaExpenses: { amount: number; currency: string; date: string }[];
  orders: ShopifyOrder[];
  vancouverOnHand: number;
}): DemandMetrics {
  const today = new Date();
  const activeContainers = containers.filter((container) => container.status !== "closed");
  const inboundPieces = activeContainers.reduce((sum, container) => sum + totalContainerPieces(container), 0);
  const sortedContainers = activeContainers
    .filter((container) => {
      const eta = getContainerEta(container);
      return eta ? eta >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;
    })
    .sort((left, right) => {
      const leftEta = getContainerEta(left)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightEta = getContainerEta(right)?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftEta - rightEta;
    });
  const nextContainer = sortedContainers[0] || null;
  const nextEta = nextContainer ? getContainerEta(nextContainer) : null;
  const nextSaleDate = nextEta ? addDays(nextEta, -saleLeadDays) : null;
  const waitDays = nextSaleDate ? Math.max(0, daysBetween(today, nextSaleDate)) : null;
  const recentOrders = getRecentOrders(orders, historicalDays);
  const soldModules = recentOrders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const selectedMetaSpend = metaExpenses
    .filter((expense) => expense.currency === "CAD" && isInHistoryWindow(expense.date, historicalDays))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const averageDailyOrders = recentOrders.length / historicalDays;
  const averageDailyModules = soldModules / historicalDays;

  return {
    averageDailyModules,
    averageDailyOrders,
    averageModulesPerOrder: recentOrders.length > 0 ? soldModules / recentOrders.length : null,
    currentMetaSpendPerDay: selectedMetaSpend > 0 ? selectedMetaSpend / historicalDays : null,
    customerAcquisitionCost: recentOrders.length > 0 && selectedMetaSpend > 0 ? selectedMetaSpend / recentOrders.length : null,
    historicalDays,
    inboundPieces,
    nextContainer,
    nextSaleDate,
    orderCount: recentOrders.length,
    selectedMetaSpend,
    soldModules,
    totalInventoryToSell: vancouverOnHand + inboundPieces,
    vancouverOnHand,
    waitDays
  };
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
            href={`/demand?history=${option.days}`}
            key={option.days}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
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
    <div className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p> : null}
    </div>
  );
}

function DemandAction({ metrics }: { metrics: DemandMetrics }) {
  const containerName = metrics.nextContainer?.container_number || "next container";
  const canRampNow = metrics.waitDays === 0;
  const hasNextContainer = Boolean(metrics.nextContainer);

  return (
    <section className="rounded-[32px] border border-blue-100 bg-blue-50 p-6 shadow-sm lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Next action</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            {!hasNextContainer
              ? "No inbound container ETA found"
              : canRampNow
                ? `Demand window is open for ${containerName}`
                : `Wait ${metrics.waitDays} days for ${containerName}`}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Demand should not be pushed until the next container is within {saleLeadDays} days of arrival. The app is using the live container ETA and live inventory counts.
          </p>
        </div>
        <div className="rounded-[24px] border border-white/80 bg-white/80 p-5 text-sm shadow-sm lg:min-w-72">
          <div className="flex items-center justify-between gap-6">
            <span className="font-medium text-slate-500">Demand opens</span>
            <span className="font-semibold text-slate-950">{formatDate(metrics.nextSaleDate)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-6">
            <span className="font-medium text-slate-500">Next ETA</span>
            <span className="font-semibold text-slate-950">{formatDate(metrics.nextContainer ? getContainerEta(metrics.nextContainer) : null)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InventoryToSell({ containers, vancouverOnHand }: { containers: ContainerEntry[]; vancouverOnHand: number }) {
  const activeContainers = containers.filter((container) => container.status !== "closed");

  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Inventory to sell</h2>
      <div className="mt-5 divide-y divide-line text-sm">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="font-medium text-slate-700">Available now</span>
          <span className="font-semibold text-slate-950">{vancouverOnHand} modules</span>
        </div>
        {activeContainers.map((container) => (
          <div className="flex items-center justify-between gap-4 py-3" key={container.id}>
            <span>
              <span className="block font-medium text-slate-700">{container.container_number}</span>
              <span className="text-xs text-blue-700">Arrives {formatDate(getContainerEta(container))}</span>
            </span>
            <span className="font-semibold text-slate-950">{totalContainerPieces(container)} modules</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Assumptions({ metrics }: { metrics: DemandMetrics }) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Live inputs</h2>
      <div className="mt-5 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Demand lead rule</span>
          <span className="font-semibold text-slate-950">{saleLeadDays} days before ETA</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Shopify orders</span>
          <span className="font-semibold text-slate-950">{metrics.orderCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Modules sold</span>
          <span className="font-semibold text-slate-950">{metrics.soldModules}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Wise Meta spend</span>
          <span className="font-semibold text-slate-950">{money(metrics.selectedMetaSpend)}</span>
        </div>
      </div>
    </section>
  );
}

export default async function DemandPage({
  searchParams
}: {
  searchParams?: Promise<{ history?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const historicalDays = getHistoryDays(resolvedSearchParams?.history);
  const { supabase } = await requireUser();
  const { data: inventoryRows, error: inventoryError } = await supabase
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
    .select("*")
    .order("eta", { ascending: true, nullsFirst: false })
    .returns<ContainerEntry[]>();
  const wiseSummary = await getWiseSummary();

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const metrics = calculateDemandMetrics({
    containers: containers || [],
    historicalDays,
    metaExpenses: wiseSummary.metaSpend.expenses,
    orders: orders || [],
    vancouverOnHand
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Demand plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            Demand Plan
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Plan ad spend using live inventory, inbound containers, Shopify sales velocity, and Wise Meta spend.
          </p>
        </div>
        <HistorySelector activeDays={historicalDays} />
      </div>

      {inventoryError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load demand data.
        </section>
      ) : (
        <div className="space-y-5">
          <DemandAction metrics={metrics} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Inventory available now" note="Vancouver on hand" value={metrics.vancouverOnHand} />
            <StatCard label="Incoming inventory" note={`${containers?.filter((container) => container.status !== "closed").length || 0} active containers`} value={metrics.inboundPieces} />
            <StatCard label="Total inventory to sell" note="On hand + inbound" value={metrics.totalInventoryToSell} />
            <StatCard label="Current sales velocity" note="Modules per day" value={metrics.averageDailyModules.toFixed(1)} />
            <StatCard label="Meta spend / day" note={`${historicalDays} day Wise window`} value={metrics.currentMetaSpendPerDay === null ? "Unavailable" : money(metrics.currentMetaSpendPerDay)} />
            <StatCard label="CAC" note="Wise Meta spend / Shopify orders" value={metrics.customerAcquisitionCost === null ? "Unavailable" : money(metrics.customerAcquisitionCost)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <InventoryToSell containers={containers || []} vancouverOnHand={metrics.vancouverOnHand} />
            <Assumptions metrics={metrics} />
          </section>
        </div>
      )}
    </main>
  );
}
