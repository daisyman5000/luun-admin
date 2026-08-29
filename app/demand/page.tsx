import Link from "next/link";
import { unstable_cache } from "next/cache";
import { DemandSaleCalendar, type DemandCalendarPlan } from "@/components/demand-sale-calendar";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, DemandSale, InventoryRow, ShopifyOrder } from "@/lib/types";

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

type SaleEvent = {
  dailyBudget: number | null;
  date: Date;
  days: DemandSale[];
  endDate: Date;
  labels: string[];
  modules: number;
  orders: number | null;
  totalBudget: number | null;
};

type DemandPlan = {
  averageDailyModules: number;
  averageModulesPerOrder: number | null;
  averageOrderValue: number | null;
  cashBalance: number;
  containersEligibleThisMonth: ContainerDemand[];
  currentMonth: string;
  customerAcquisitionCost: number | null;
  maxRevenue: number | null;
  openPayables: number;
  selectedMonth: MonthOption;
  recommendedSaleStart: Date | null;
  saleEvents: SaleEvent[];
  targetMetaBudget: number | null;
  targetModulesToSell: number;
  targetOrdersToSell: number | null;
  vancouverOnHand: number;
};

const saleLeadDays = 20;
const getCachedWiseSummary = unstable_cache(getWiseSummary, ["wise-summary-demand"], { revalidate: 300 });

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateInputValue(date: Date) {
  return `${dateKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
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

  return Array.from({ length: 2 }, (_, index) => {
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

function calculateAverageOrderValue(orders: ShopifyOrder[]) {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  return orders.length > 0 && revenue > 0 ? revenue / orders.length : null;
}

function calculateAverageDailyModules(orders: ShopifyOrder[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recentOrders = orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
  });
  const recentModules = recentOrders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);

  return recentModules / 30;
}

function buildSaleEvents({
  averageModulesPerOrder,
  containers,
  customerAcquisitionCost,
  plannedSales,
  vancouverOnHand
}: {
  averageModulesPerOrder: number | null;
  containers: ContainerDemand[];
  customerAcquisitionCost: number | null;
  plannedSales: DemandSale[];
  vancouverOnHand: number;
}) {
  if (plannedSales.length === 0) return [];

  const saleDate = new Date(`${plannedSales[0].sale_date}T00:00:00`);
  const endDate = new Date(`${plannedSales[plannedSales.length - 1].sale_date}T00:00:00`);
  const labels = ["Vancouver on hand"];
  let modules = vancouverOnHand;

  for (const item of containers) {
    if (!item.demandOpenDate || item.pieces <= 0) continue;
    if (item.demandOpenDate > saleDate) continue;

    modules += item.pieces;
    labels.push(item.container.container_number);
  }

  const orders = averageModulesPerOrder && modules > 0 ? Math.ceil(modules / averageModulesPerOrder) : null;
  const totalBudget = orders !== null && customerAcquisitionCost !== null ? orders * customerAcquisitionCost : null;

  return [{
    dailyBudget: totalBudget === null ? null : totalBudget / plannedSales.length,
    date: saleDate,
    days: plannedSales,
    endDate,
    labels: modules > 0 ? labels : [],
    modules,
    orders,
    totalBudget
  }];
}

function calculateDemandPlan({
  containers,
  customerAcquisitionCost,
  cashBalance,
  orders,
  plannedSales,
  selectedMonth,
  vancouverOnHand
}: {
  containers: ContainerEntry[];
  customerAcquisitionCost: number | null;
  cashBalance: number;
  orders: ShopifyOrder[];
  plannedSales: DemandSale[];
  selectedMonth: MonthOption;
  vancouverOnHand: number;
}): DemandPlan {
  const today = new Date();
  const currentMonth = dateKey(today);
  const averageModulesPerOrder = calculateAverageModulesPerOrder(orders);
  const averageOrderValue = calculateAverageOrderValue(orders);
  const averageDailyModules = calculateAverageDailyModules(orders);
  const activeContainers = containers.filter((container) => container.status !== "closed");
  const openPayables = activeContainers.reduce((sum, container) => sum + Number(container.amount_to_be_paid || 0), 0);
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
  const selectedContainerPieces = containersEligibleThisMonth.reduce((sum, item) => sum + item.pieces, 0);
  const selectedVancouverOnHand = vancouverOnHand;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const firstPossibleSaleDate = selectedVancouverOnHand > 0
    ? selectedMonth.month === currentMonth
      ? todayStart
      : selectedMonth.start
    : containersEligibleThisMonth[0]?.demandOpenDate || null;
  const saleEvents = buildSaleEvents({
    averageModulesPerOrder,
    containers: containersEligibleThisMonth,
    customerAcquisitionCost,
    plannedSales,
    vancouverOnHand: selectedVancouverOnHand
  });
  const targetModulesToSell = selectedVancouverOnHand + selectedContainerPieces;
  const targetOrdersToSell = averageModulesPerOrder
    ? Math.ceil(targetModulesToSell / averageModulesPerOrder)
    : null;

  return {
    averageDailyModules,
    averageModulesPerOrder,
    averageOrderValue,
    cashBalance,
    containersEligibleThisMonth,
    currentMonth,
    customerAcquisitionCost,
    maxRevenue: targetOrdersToSell !== null && averageOrderValue !== null
      ? targetOrdersToSell * averageOrderValue
      : null,
    openPayables,
    recommendedSaleStart: firstPossibleSaleDate,
    selectedMonth,
    saleEvents,
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

function MonthlyInventoryList({ plan }: { plan: DemandPlan }) {
  function saleRangeFor(label: string) {
    const event = plan.saleEvents.find((saleEvent) => saleEvent.labels.includes(label));
    if (!event) return "Not scheduled";
    return `${formatDate(event.date)} to ${formatDate(event.endDate)}`;
  }

  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Inventory available to sell this month</h2>
      <div className="mt-5 divide-y divide-line text-sm">
        {plan.vancouverOnHand > 0 ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <span>
              <span className="block font-medium text-slate-700">Vancouver on hand</span>
              <span className="text-xs text-blue-700">{saleRangeFor("Vancouver on hand")}</span>
            </span>
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
                  Sale {saleRangeFor(item.container.container_number)}. ETA {formatDate(item.eta)}
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

function toCalendarPlan(plan: DemandPlan): DemandCalendarPlan {
  return {
    defaultSale: {
      averageDailyModules: plan.averageDailyModules,
      averageModulesPerOrder: plan.averageModulesPerOrder,
      averageOrderValue: plan.averageOrderValue,
      cashBalance: plan.cashBalance,
      customerAcquisitionCost: plan.customerAcquisitionCost,
      modules: plan.targetModulesToSell,
      openPayables: plan.openPayables,
      orders: plan.targetOrdersToSell,
      recommendedStartDate: plan.recommendedSaleStart ? dateInputValue(plan.recommendedSaleStart) : null,
      totalBudget: plan.targetMetaBudget
    },
    monthLabel: plan.selectedMonth.label,
    saleEvents: plan.saleEvents.map((event) => ({
      dailyBudget: event.dailyBudget,
      date: dateInputValue(event.date),
      days: event.days.map((day) => ({
        date: day.sale_date,
        id: day.id
      })),
      endDate: dateInputValue(event.endDate),
      labels: event.labels,
      modules: event.modules,
      orders: event.orders,
      totalBudget: event.totalBudget
    })),
    selectedMonth: {
      endDay: plan.selectedMonth.end.getDate(),
      firstDay: plan.selectedMonth.start.getDay(),
      month: plan.selectedMonth.month
    }
  };
}

export default async function DemandPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthOptions = getMonthOptions(resolvedSearchParams?.month);
  const selectedMonth = monthOptions.find((option) => option.isActive) || monthOptions[0];
  const saleQueryEnd = addDays(selectedMonth.end, 120);
  const { profile, supabase } = await requireUser();
  const [
    { data: inventoryRows, error: inventoryError },
    { data: orders },
    { data: containers },
    { data: plannedSales, error: plannedSalesError },
    wiseSummary
  ] = await Promise.all([
    supabase
      .from("inventory")
      .select("available_qty")
      .returns<Pick<InventoryRow, "available_qty">[]>(),
    supabase
      .from("shopify_orders")
      .select("created_at,total_modules,total_price")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<ShopifyOrder[]>(),
    supabase
      .from("container_entries")
      .select("*")
      .order("eta", { ascending: true, nullsFirst: false })
      .returns<ContainerEntry[]>(),
    supabase
      .from("demand_sales")
      .select("*")
      .gte("sale_date", dateInputValue(selectedMonth.start))
      .lte("sale_date", dateInputValue(saleQueryEnd))
      .order("sale_date", { ascending: true })
      .returns<DemandSale[]>(),
    getCachedWiseSummary()
  ]);

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const cashBalance = wiseSummary.balances
    .filter((balance) => balance.currency === "CAD")
    .reduce((sum, balance) => sum + balance.amount, 0);
  const customerAcquisitionCost = calculateCustomerAcquisitionCost({
    metaExpenses: wiseSummary.metaSpend.expenses,
    orders: orders || []
  });
  const plan = calculateDemandPlan({
    containers: containers || [],
    cashBalance,
    customerAcquisitionCost,
    orders: orders || [],
    plannedSales: plannedSales || [],
    selectedMonth,
    vancouverOnHand
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">Demand</h1>
          <p className="mt-1 text-sm text-slate-500">{selectedMonth.label}</p>
        </div>
        <MonthSelector options={monthOptions} />
      </div>

      {inventoryError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load demand data.
        </section>
      ) : (
        <div className="space-y-5">
          {plannedSalesError ? (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Demand sale dates are not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Maximum modules to sell" note="Vancouver on-hand plus containers inside the 20-day rule" value={plan.targetModulesToSell} />
            <StatCard label="Maximum orders to sell" note="Maximum modules / live avg modules per order" value={plan.targetOrdersToSell ?? "Unavailable"} />
            <StatCard label="Avg modules per order" note="From imported Shopify orders" value={plan.averageModulesPerOrder === null ? "Unavailable" : plan.averageModulesPerOrder.toFixed(1)} />
            <StatCard label="CAC" note="Wise Meta spend / Shopify orders" value={plan.customerAcquisitionCost === null ? "Unavailable" : money(plan.customerAcquisitionCost)} />
            <StatCard label="Required Meta budget" note="Maximum orders x live CAC" value={plan.targetMetaBudget === null ? "Unavailable" : money(plan.targetMetaBudget)} />
            <StatCard label="Max revenue" note="Maximum orders x live average order value" value={plan.maxRevenue === null ? "Unavailable" : money(plan.maxRevenue)} />
          </section>

          <DemandSaleCalendar canEdit={!plannedSalesError && canUpdateOrderLogistics(profile?.role)} plan={toCalendarPlan(plan)} />
          <MonthlyInventoryList plan={plan} />
        </div>
      )}
    </main>
  );
}
