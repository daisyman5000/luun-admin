import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

type CashCycle = {
  averageDailyModules: number;
  averageModuleValue: number;
  cashBalance: number;
  days: number | null;
  historicalDays: number;
  inboundPieces: number;
  inventoryValue: number;
  openContainerPayables: number;
  orderCount: number;
  revenue: number;
  soldModules: number;
  totalPiecesToConvert: number;
  vancouverOnHand: number;
};

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

function totalContainerPieces(container: ContainerEntry) {
  return (container.manifest_json || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function calculateCashCycle({
  containers,
  historicalDays,
  orders,
  vancouverOnHand,
  wiseCash
}: {
  containers: ContainerEntry[];
  historicalDays: number;
  orders: ShopifyOrder[];
  vancouverOnHand: number;
  wiseCash: number;
}): CashCycle {
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

  return {
    averageDailyModules,
    averageModuleValue,
    cashBalance: wiseCash,
    days: averageDailyModules > 0 ? Math.ceil(totalPiecesToConvert / averageDailyModules) : null,
    historicalDays,
    inboundPieces,
    inventoryValue: totalPiecesToConvert * averageModuleValue,
    openContainerPayables: activeContainers.reduce((sum, container) => sum + Number(container.amount_to_be_paid || 0), 0),
    orderCount: recentOrders.length,
    revenue,
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

function CashCyclePanel({ cycle }: { cycle: CashCycle }) {
  const cashAfterPayables = cycle.cashBalance - cycle.openContainerPayables;

  return (
    <section className="rounded-[32px] border border-blue-100 bg-blue-50 p-6 shadow-sm lg:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Cash conversion cycle</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            {cycle.days === null ? "Needs sales data" : `${cycle.days} days`}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            CCC estimate based on Vancouver on-hand inventory plus active container manifests, divided by Shopify module sales velocity.
          </p>
        </div>
        <HistorySelector activeDays={cycle.historicalDays} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vancouver on hand" note="Current sellable inventory" value={cycle.vancouverOnHand} />
        <StatCard label="Inbound containers" note="From container manifests" value={cycle.inboundPieces} />
        <StatCard label="Total pieces to convert" note="On hand + inbound" value={cycle.totalPiecesToConvert} />
        <StatCard label="Sales velocity" note="Modules per day" value={cycle.averageDailyModules.toFixed(1)} />
        <StatCard label="Modules sold" note={`${cycle.orderCount} Shopify orders`} value={cycle.soldModules} />
        <StatCard label="Revenue in window" note={`${cycle.historicalDays} day Shopify window`} value={money(cycle.revenue)} />
        <StatCard label="Inventory value" note="Pieces x average module value" value={money(cycle.inventoryValue)} />
        <StatCard label="Cash after payables" note="Wise cash minus open container payables" value={money(cashAfterPayables)} />
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
    .select("amount_to_be_paid,manifest_json,status")
    .returns<ContainerEntry[]>();
  const wiseSummary = await getWiseSummary();

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const cadCash = wiseSummary.balances
    .filter((balance) => balance.currency === "CAD")
    .reduce((sum, balance) => sum + balance.amount, 0);
  const cashCycle = calculateCashCycle({
    containers: containers || [],
    historicalDays,
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
        <CashCyclePanel cycle={cashCycle} />
      )}
    </main>
  );
}
