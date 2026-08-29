import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

type MonthOption = {
  end: Date;
  href: string;
  isActive: boolean;
  label: string;
  month: string;
  start: Date;
};

type ContainerDemand = {
  container: ContainerEntry;
  demandOpenDate: Date | null;
  eta: Date | null;
  pieces: number;
};

type DemandPlan = {
  averageModulesPerOrder: number | null;
  containersEligibleThisMonth: ContainerDemand[];
  customerAcquisitionCost: number | null;
  currentMonth: string;
  daysUntilNextDemandWindow: number | null;
  nextDemandContainer: ContainerDemand | null;
  selectedMonth: MonthOption;
  targetMetaBudget: number | null;
  targetModulesToSell: number;
  targetOrdersToSell: number | null;
  vancouverOnHand: number;
};

const saleLeadDays = 20;

function dateKey(date: Date) {
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
  const currentMonth = dateKey(today);
  const selectedMonth = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentMonth;

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    const month = dateKey(date);
    const { end, start } = monthBounds(month);

    return {
      end,
      href: `/demand?month=${month}`,
      isActive: month === selectedMonth,
      label: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date),
      month,
      start
    };
  });
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

function totalContainerPieces(container: ContainerEntry) {
  return (container.manifest_json || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function formatDate(date: Date | null) {
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function calculateCustomerAcquisitionCost({
  metaExpenses,
  orders
}: {
  metaExpenses: { amount: number; currency: string; date: string }[];
  orders: ShopifyOrder[];
}) {
  const cadMetaExpenses = metaExpenses.filter((expense) => expense.currency === "CAD");
  const firstMetaDate = cadMetaExpenses[0]?.date ? new Date(cadMetaExpenses[0].date) : null;
  const ordersInWindow = firstMetaDate
    ? orders.filter((order) => new Date(order.created_at) >= firstMetaDate)
    : orders;
  const totalMetaSpend = cadMetaExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  if (ordersInWindow.length === 0 || totalMetaSpend <= 0) return null;
  return totalMetaSpend / ordersInWindow.length;
}

function calculateAverageModulesPerOrder(orders: ShopifyOrder[]) {
  const totalModules = orders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  return orders.length > 0 && totalModules > 0 ? totalModules / orders.length : null;
}

function calculateDemandPlan({
  containers,
  customerAcquisitionCost,
  orders,
  selectedMonth,
  vancouverOnHand
}: {
  containers: ContainerEntry[];
  customerAcquisitionCost: number | null;
  orders: ShopifyOrder[];
  selectedMonth: MonthOption;
  vancouverOnHand: number;
}): DemandPlan {
  const today = new Date();
  const currentMonth = dateKey(today);
  const averageModulesPerOrder = calculateAverageModulesPerOrder(orders);
  const activeContainers = containers.filter((container) => container.status !== "closed");
  const containerDemand = activeContainers
    .map((container) => {
      const eta = getContainerEta(container);
      return {
        container,
        demandOpenDate: eta ? addDays(eta, -saleLeadDays) : null,
        eta,
        pieces: totalContainerPieces(container)
      };
    })
    .sort((left, right) => (left.demandOpenDate?.getTime() || Number.MAX_SAFE_INTEGER) - (right.demandOpenDate?.getTime() || Number.MAX_SAFE_INTEGER));
  const containersEligibleThisMonth = containerDemand.filter((item) =>
    Boolean(
      item.demandOpenDate &&
        item.eta &&
        item.demandOpenDate <= selectedMonth.end &&
        item.eta >= selectedMonth.start
    )
  );
  const nextDemandContainer = containerDemand.find((item) => {
    if (!item.demandOpenDate) return false;
    return item.demandOpenDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }) || null;
  const selectedContainerPieces = containersEligibleThisMonth.reduce((sum, item) => sum + item.pieces, 0);
  const targetModulesToSell = selectedMonth.month === currentMonth
    ? vancouverOnHand + selectedContainerPieces
    : selectedContainerPieces;
  const targetOrdersToSell = averageModulesPerOrder
    ? Math.ceil(targetModulesToSell / averageModulesPerOrder)
    : null;

  return {
    averageModulesPerOrder,
    containersEligibleThisMonth,
    currentMonth,
    customerAcquisitionCost,
    daysUntilNextDemandWindow: nextDemandContainer?.demandOpenDate
      ? Math.max(0, daysBetween(today, nextDemandContainer.demandOpenDate))
      : null,
    nextDemandContainer,
    selectedMonth,
    targetMetaBudget: targetOrdersToSell !== null && customerAcquisitionCost !== null
      ? targetOrdersToSell * customerAcquisitionCost
      : null,
    targetModulesToSell,
    targetOrdersToSell,
    vancouverOnHand
  };
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

function DemandAction({ plan }: { plan: DemandPlan }) {
  const waitDays = plan.daysUntilNextDemandWindow;
  const containerName = plan.nextDemandContainer?.container.container_number || "next container";

  return (
    <section className="rounded-[32px] border border-blue-100 bg-blue-50 p-6 shadow-sm lg:p-8">
      <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Next action</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
        {waitDays === null
          ? "No upcoming container demand window"
          : waitDays === 0
            ? `Demand window is open for ${containerName}`
            : `Wait ${waitDays} days for ${containerName}`}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Incoming inventory becomes eligible for advertising when its ETA to Canada is within {saleLeadDays} days. This uses live container ETAs, not a past-period filter.
      </p>
    </section>
  );
}

function MonthlyInventoryList({ plan }: { plan: DemandPlan }) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Inventory available to sell this month</h2>
      <div className="mt-5 divide-y divide-line text-sm">
        {plan.selectedMonth.month === plan.currentMonth ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="font-medium text-slate-700">Available now</span>
            <span className="font-semibold text-slate-950">{plan.vancouverOnHand} modules</span>
          </div>
        ) : null}
        {plan.containersEligibleThisMonth.length === 0 ? (
          <div className="py-3 text-slate-500">No containers are inside the 20-day advertising window this month.</div>
        ) : (
          plan.containersEligibleThisMonth.map((item) => (
            <div className="flex items-center justify-between gap-4 py-3" key={item.container.id}>
              <span>
                <span className="block font-medium text-slate-700">{item.container.container_number}</span>
                <span className="text-xs text-blue-700">
                  Advertising opens {formatDate(item.demandOpenDate)}. ETA {formatDate(item.eta)}
                </span>
              </span>
              <span className="font-semibold text-slate-950">{item.pieces} modules</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default async function DemandPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthOptions = getMonthOptions(resolvedSearchParams?.month);
  const selectedMonth = monthOptions.find((option) => option.isActive) || monthOptions[0];
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
  const customerAcquisitionCost = calculateCustomerAcquisitionCost({
    metaExpenses: wiseSummary.metaSpend.expenses,
    orders: orders || []
  });
  const plan = calculateDemandPlan({
    containers: containers || [],
    customerAcquisitionCost,
    orders: orders || [],
    selectedMonth,
    vancouverOnHand
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Demand plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            {selectedMonth.label}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Forward monthly sell plan based on live inventory, container ETAs, Shopify orders, and Wise Meta spend.
          </p>
        </div>
        <MonthSelector options={monthOptions} />
      </div>

      {inventoryError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load demand data.
        </section>
      ) : (
        <div className="space-y-5">
          <DemandAction plan={plan} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Maximum modules to sell" note="On hand plus containers inside the 20-day rule" value={plan.targetModulesToSell} />
            <StatCard label="Maximum orders to sell" note="Maximum modules / live avg modules per order" value={plan.targetOrdersToSell ?? "Unavailable"} />
            <StatCard label="Avg modules per order" note="From imported Shopify orders" value={plan.averageModulesPerOrder === null ? "Unavailable" : plan.averageModulesPerOrder.toFixed(1)} />
            <StatCard label="CAC" note="Wise Meta spend / Shopify orders" value={plan.customerAcquisitionCost === null ? "Unavailable" : money(plan.customerAcquisitionCost)} />
            <StatCard label="Required Meta budget" note="Maximum orders x live CAC" value={plan.targetMetaBudget === null ? "Unavailable" : money(plan.targetMetaBudget)} />
          </section>

          <MonthlyInventoryList plan={plan} />
        </div>
      )}
    </main>
  );
}
