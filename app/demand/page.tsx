import Link from "next/link";
import { unstable_cache } from "next/cache";
import { DemandSaleCalendar, type DemandCalendarPlan, type DemandCashObligation } from "@/components/demand-sale-calendar";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import { convertToCad, getCadRates } from "@/lib/currency";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, DemandSale, InventoryRow, MajorExpense, ShopifyOrder, WayflyerPayment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  activeContainerCount: number;
  averageDailyModules: number;
  averageModulesPerOrder: number | null;
  averageOrderValue: number | null;
  cacMetaSpend: number;
  cacOrderCount: number;
  cashBalance: number;
  cashObligations: DemandCashObligation[];
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
  totalActiveInboundModules: number;
  vancouverOnHand: number;
  wiseCashBalance: number;
};

const saleLeadDays = 20;
const salesCashLeadDays = 7;
const getCachedWiseSummary = unstable_cache(getWiseSummary, ["wise-summary-demand"], { revalidate: 300 });

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateInputValue(date: Date) {
  return `${dateKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return dateInputValue(new Date());
}

function obligationDate(obligation: Pick<DemandCashObligation, "dueDate">) {
  return obligation.dueDate || todayKey();
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
  const firstPlanningDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const firstPlanningMonth = dateKey(firstPlanningDate);
  const requestedMonth = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : firstPlanningMonth;
  const selectedMonth = requestedMonth < firstPlanningMonth ? firstPlanningMonth : requestedMonth;

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(firstPlanningDate.getFullYear(), firstPlanningDate.getMonth() + index, 1);
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

function calculateCustomerAcquisitionCost({
  metaExpenses,
  orders
}: {
  metaExpenses: { amount: number; currency: string; date: string }[];
  orders: ShopifyOrder[];
}) {
  const cadMetaExpenses = metaExpenses
    .filter((expense) => expense.currency === "CAD")
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const firstMetaDate = cadMetaExpenses[0]?.date ? new Date(cadMetaExpenses[0].date) : null;
  const ordersInWindow = firstMetaDate
    ? orders.filter((order) => new Date(order.created_at) >= firstMetaDate)
    : orders;
  const totalMetaSpend = cadMetaExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    metaSpend: totalMetaSpend,
    orderCount: ordersInWindow.length,
    value: ordersInWindow.length === 0 || totalMetaSpend <= 0 ? null : totalMetaSpend / ordersInWindow.length
  };
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

function groupSaleCampaigns(plannedSales: DemandSale[]) {
  const sortedSales = [...plannedSales].sort((left, right) => left.sale_date.localeCompare(right.sale_date));
  const campaigns: DemandSale[][] = [];

  for (const sale of sortedSales) {
    const currentCampaign = campaigns.at(-1);
    const previousSale = currentCampaign?.at(-1);

    if (!currentCampaign || !previousSale) {
      campaigns.push([sale]);
      continue;
    }

    const expectedNextDate = dateInputValue(addDays(new Date(`${previousSale.sale_date}T00:00:00`), 1));
    if (sale.sale_date === expectedNextDate) {
      currentCampaign.push(sale);
    } else {
      campaigns.push([sale]);
    }
  }

  return campaigns;
}

function inventoryEligibleByDate({
  containerDemand,
  date,
  vancouverOnHand
}: {
  containerDemand: ContainerDemand[];
  date: Date;
  vancouverOnHand: number;
}) {
  return vancouverOnHand + containerDemand.reduce((sum, item) => {
    if (!item.demandOpenDate || item.demandOpenDate > date) return sum;
    return sum + item.pieces;
  }, 0);
}

function consumedModulesBeforeDate({
  beforeDate,
  containerDemand,
  plannedSales,
  vancouverOnHand
}: {
  beforeDate: Date;
  containerDemand: ContainerDemand[];
  plannedSales: DemandSale[];
  vancouverOnHand: number;
}) {
  let consumedModules = 0;

  for (const campaign of groupSaleCampaigns(plannedSales)) {
    const campaignStart = new Date(`${campaign[0].sale_date}T00:00:00`);
    const soldDaysBeforeDate = campaign.filter((sale) => new Date(`${sale.sale_date}T00:00:00`) < beforeDate).length;
    if (soldDaysBeforeDate === 0) continue;

    const eligibleInventory = inventoryEligibleByDate({
      containerDemand,
      date: campaignStart,
      vancouverOnHand
    });
    const availableForCampaign = Math.max(0, eligibleInventory - consumedModules);
    const dailyModules = availableForCampaign / campaign.length;
    consumedModules += Math.min(availableForCampaign, dailyModules * soldDaysBeforeDate);
  }

  return Math.ceil(consumedModules);
}

function projectedCashBeforeDate({
  averageModulesPerOrder,
  averageOrderValue,
  beforeDate,
  cashBalance,
  cashObligations,
  containerDemand,
  customerAcquisitionCost,
  plannedSales,
  vancouverOnHand
}: {
  averageModulesPerOrder: number | null;
  averageOrderValue: number | null;
  beforeDate: Date;
  cashBalance: number;
  cashObligations: DemandCashObligation[];
  containerDemand: ContainerDemand[];
  customerAcquisitionCost: number | null;
  plannedSales: DemandSale[];
  vancouverOnHand: number;
}) {
  const beforeDateKey = dateInputValue(beforeDate);
  let projectedCash = cashBalance;
  let consumedModules = 0;

  for (const obligation of cashObligations) {
    if (obligationDate(obligation) >= beforeDateKey) continue;
    projectedCash -= obligation.amountCad || 0;
  }

  if (!averageModulesPerOrder || !averageOrderValue || !customerAcquisitionCost) {
    return projectedCash;
  }

  for (const campaign of groupSaleCampaigns(plannedSales)) {
    const campaignStart = new Date(`${campaign[0].sale_date}T00:00:00`);
    const eligibleInventory = inventoryEligibleByDate({
      containerDemand,
      date: campaignStart,
      vancouverOnHand
    });
    const availableForCampaign = Math.max(0, eligibleInventory - consumedModules);
    const campaignOrders = availableForCampaign > 0 ? Math.ceil(availableForCampaign / averageModulesPerOrder) : 0;
    const dailyAdSpend = campaign.length > 0 ? (campaignOrders * customerAcquisitionCost) / campaign.length : 0;
    const dailyRevenue = campaign.length > 0 ? (campaignOrders * averageOrderValue) / campaign.length : 0;

    for (const sale of campaign) {
      if (sale.sale_date < beforeDateKey) {
        projectedCash -= dailyAdSpend;
      }

      const revenueDate = dateInputValue(addDays(new Date(`${sale.sale_date}T00:00:00`), salesCashLeadDays));
      if (revenueDate < beforeDateKey) {
        projectedCash += dailyRevenue;
      }
    }

    const soldDaysBeforeDate = campaign.filter((sale) => new Date(`${sale.sale_date}T00:00:00`) < beforeDate).length;
    const dailyModules = campaign.length > 0 ? availableForCampaign / campaign.length : 0;
    consumedModules += Math.min(availableForCampaign, dailyModules * soldDaysBeforeDate);
  }

  return projectedCash;
}

function availableModulesForDate({
  containerDemand,
  date,
  plannedSales,
  vancouverOnHand
}: {
  containerDemand: ContainerDemand[];
  date: Date;
  plannedSales: DemandSale[];
  vancouverOnHand: number;
}) {
  const eligibleInventory = inventoryEligibleByDate({ containerDemand, date, vancouverOnHand });
  const consumedModules = consumedModulesBeforeDate({
    beforeDate: date,
    containerDemand,
    plannedSales,
    vancouverOnHand
  });

  return Math.max(0, eligibleInventory - consumedModules);
}

function buildSaleEvents({
  averageModulesPerOrder,
  containers,
  customerAcquisitionCost,
  modules,
  plannedSales
}: {
  averageModulesPerOrder: number | null;
  containers: ContainerDemand[];
  customerAcquisitionCost: number | null;
  modules: number;
  plannedSales: DemandSale[];
}) {
  if (plannedSales.length === 0) return [];

  const saleDate = new Date(`${plannedSales[0].sale_date}T00:00:00`);
  const endDate = new Date(`${plannedSales[plannedSales.length - 1].sale_date}T00:00:00`);
  const labels = modules > 0 ? ["Carry-forward inventory"] : [];

  for (const item of containers) {
    if (!item.demandOpenDate || item.pieces <= 0) continue;
    if (item.demandOpenDate > saleDate) continue;
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
  cashObligations,
  cacMetaSpend,
  cacOrderCount,
  orders,
  plannedSales,
  selectedMonth,
  vancouverOnHand
}: {
  containers: ContainerEntry[];
  customerAcquisitionCost: number | null;
  cashBalance: number;
  cashObligations: DemandCashObligation[];
  cacMetaSpend: number;
  cacOrderCount: number;
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
  const totalActiveInboundModules = activeContainers.reduce((sum, container) => sum + totalContainerPieces(container), 0);
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
  const projectedStartingCash = projectedCashBeforeDate({
    averageModulesPerOrder,
    averageOrderValue,
    beforeDate: selectedMonth.start,
    cashBalance,
    cashObligations,
    containerDemand,
    customerAcquisitionCost,
    plannedSales,
    vancouverOnHand
  });
  const containersEligibleThisMonth = containerDemand.filter((item) =>
    Boolean(
      item.demandOpenDate &&
        item.eta &&
        item.demandOpenDate <= selectedMonth.end &&
        item.eta >= selectedMonth.start
    )
  );
  const selectedVancouverOnHand = vancouverOnHand;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const consumedBeforeMonth = consumedModulesBeforeDate({
    beforeDate: selectedMonth.start,
    containerDemand,
    plannedSales,
    vancouverOnHand: selectedVancouverOnHand
  });
  const targetModulesToSell = Math.max(
    0,
    inventoryEligibleByDate({
      containerDemand,
      date: selectedMonth.end,
      vancouverOnHand: selectedVancouverOnHand
    }) - consumedBeforeMonth
  );
  const firstPossibleSaleDate = targetModulesToSell > 0
    ? selectedMonth.month === currentMonth
      ? todayStart
      : selectedMonth.start
    : containersEligibleThisMonth.find((item) => item.demandOpenDate && item.demandOpenDate >= selectedMonth.start)?.demandOpenDate || null;
  const selectedMonthSales = plannedSales.filter((sale) => {
    const saleDateValue = new Date(`${sale.sale_date}T00:00:00`);
    return saleDateValue >= selectedMonth.start && saleDateValue <= selectedMonth.end;
  });
  const saleStartDate = selectedMonthSales[0]?.sale_date
    ? new Date(`${selectedMonthSales[0].sale_date}T00:00:00`)
    : selectedMonth.start;
  const saleModules = availableModulesForDate({
    containerDemand,
    date: saleStartDate,
    plannedSales,
    vancouverOnHand: selectedVancouverOnHand
  });
  const saleEvents = buildSaleEvents({
    averageModulesPerOrder,
    containers: containerDemand,
    customerAcquisitionCost,
    modules: saleModules,
    plannedSales: selectedMonthSales
  });
  const targetOrdersToSell = averageModulesPerOrder
    ? Math.ceil(targetModulesToSell / averageModulesPerOrder)
    : null;

  return {
    activeContainerCount: activeContainers.length,
    averageDailyModules,
    averageModulesPerOrder,
    averageOrderValue,
    cacMetaSpend,
    cacOrderCount,
    cashBalance: projectedStartingCash,
    cashObligations,
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
    totalActiveInboundModules,
    vancouverOnHand,
    wiseCashBalance: cashBalance
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

function toCalendarPlan(plan: DemandPlan): DemandCalendarPlan {
  return {
    cashObligations: plan.cashObligations.filter((obligation) => obligationDate(obligation) >= dateInputValue(plan.selectedMonth.start)),
    defaultSale: {
      averageDailyModules: plan.averageDailyModules,
      averageModulesPerOrder: plan.averageModulesPerOrder,
      activeContainerCount: plan.activeContainerCount,
      averageOrderValue: plan.averageOrderValue,
      cacMetaSpend: plan.cacMetaSpend,
      cacOrderCount: plan.cacOrderCount,
      cashBalance: plan.cashBalance,
      customerAcquisitionCost: plan.customerAcquisitionCost,
      modules: plan.targetModulesToSell,
      openPayables: plan.openPayables,
      orders: plan.targetOrdersToSell,
      recommendedStartDate: plan.recommendedSaleStart ? dateInputValue(plan.recommendedSaleStart) : null,
      totalActiveInboundModules: plan.totalActiveInboundModules,
      totalBudget: plan.targetMetaBudget,
      vancouverOnHand: plan.vancouverOnHand,
      wiseCashBalance: plan.wiseCashBalance
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
  const saleQueryStart = monthOptions[0].start;
  const { profile, supabase } = await requireUser();
  const [
    { data: inventoryRows, error: inventoryError },
    { data: orders },
    { data: containers },
    { data: plannedSales, error: plannedSalesError },
    { data: majorExpenses, error: majorExpensesError },
    { data: wayflyerPayments, error: wayflyerPaymentsError },
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
      .gte("sale_date", dateInputValue(saleQueryStart))
      .lte("sale_date", dateInputValue(saleQueryEnd))
      .order("sale_date", { ascending: true })
      .returns<DemandSale[]>(),
    supabase
      .from("major_expenses")
      .select("*")
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<MajorExpense[]>(),
    supabase
      .from("wayflyer_payments")
      .select("*")
      .eq("status", "scheduled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<WayflyerPayment[]>(),
    getCachedWiseSummary()
  ]);
  const obligationCurrencies = [
    ...(containers || []).map((container) => container.amount_currency || "USD"),
    ...(majorExpenses || []).map((expense) => expense.currency || "CAD"),
    ...(wayflyerPayments || []).map((payment) => payment.currency || "CAD")
  ];
  const cadRates = await getCadRates(obligationCurrencies);

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const containerObligations: DemandCashObligation[] = (containers || [])
    .filter((container) => container.status !== "closed" && Number(container.amount_to_be_paid || 0) > 0)
    .map((container) => {
      const amount = Number(container.amount_to_be_paid || 0);
      const currency = container.amount_currency || "USD";
      return {
        amount,
        amountCad: convertToCad(amount, currency, cadRates),
        currency,
        dueDate: container.payment_due_at || container.eta,
        id: container.id,
        label: container.container_number,
        type: "container"
      };
    });
  const invoiceObligations: DemandCashObligation[] = (majorExpenses || []).map((expense) => ({
    amount: Number(expense.amount || 0),
    amountCad: convertToCad(Number(expense.amount || 0), expense.currency || "CAD", cadRates),
    currency: expense.currency || "CAD",
    dueDate: expense.due_date,
    id: expense.id,
    label: expense.label,
    type: "invoice"
  }));
  const wayflyerObligations: DemandCashObligation[] = (wayflyerPayments || []).map((payment) => ({
    amount: Number(payment.amount || 0),
    amountCad: convertToCad(Number(payment.amount || 0), payment.currency || "CAD", cadRates),
    currency: payment.currency || "CAD",
    dueDate: payment.due_date,
    id: payment.id,
    label: payment.label,
    type: "wayflyer"
  }));
  const cashObligations = [...containerObligations, ...invoiceObligations, ...wayflyerObligations];
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
    cashObligations,
    cacMetaSpend: customerAcquisitionCost.metaSpend,
    cacOrderCount: customerAcquisitionCost.orderCount,
    customerAcquisitionCost: customerAcquisitionCost.value,
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

          {majorExpensesError ? (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Major invoices are not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </section>
          ) : null}

          {wayflyerPaymentsError ? (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Wayflyer payments are not ready in Supabase yet. Apply the latest database migration, then refresh this page.
            </section>
          ) : null}

          <DemandSaleCalendar canEdit={!plannedSalesError && canUpdateOrderLogistics(profile?.role)} plan={toCalendarPlan(plan)} />
        </div>
      )}
    </main>
  );
}
