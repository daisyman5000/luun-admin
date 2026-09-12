import Link from "next/link";
import { unstable_cache } from "next/cache";
import { DemandSaleCalendar, type DemandCalendarPlan } from "@/components/demand-sale-calendar";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

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
  breakdown: ModuleBreakdown;
  pieces: number;
  eta: Date | null;
};

type ModuleSlug = "corner" | "armless" | "ottoman";
type ModuleBreakdown = Record<ModuleSlug, number>;
type ModuleRevenue = Record<ModuleSlug, number | null>;

type DemandPlan = {
  averageRevenuePerModule: number | null;
  averageModulesPerOrder: number | null;
  customerAcquisitionCost: number | null;
  incomingContainers: {
    breakdown: ModuleBreakdown;
    eta: string | null;
    pieces: number;
  }[];
  incomingModulesByType: ModuleBreakdown;
  maxRevenue: number | null;
  moduleRevenue: ModuleRevenue;
  plannedSoldByType: ModuleBreakdown;
  selectedMonth: MonthOption;
  shopifyProjectionMonth: string | null;
  targetModulesByType: ModuleBreakdown;
  targetMetaBudget: number | null;
  targetModulesToSell: number;
  targetOrdersToSell: number | null;
  totalActiveInboundModules: number;
  eligibleInboundByType: ModuleBreakdown;
  plannedSoldBeforeMonthByType: ModuleBreakdown;
  vancouverOnHandByType: ModuleBreakdown;
  vancouverOnHand: number;
};

const defaultDailyAdBudget = 400;
const defaultSaleDurationDays = 10;
const defaultMaxDaysApart = 3;
const defaultSellBeforeEtaDays = 0;
const getCachedWiseSummary = unstable_cache(getWiseSummary, ["wise-summary-demand"], { revalidate: 300 });
const revenuePaymentStatuses = new Set(["PAID", "PARTIALLY_REFUNDED"]);

type ShopifyProjectionMetrics = {
  averageRevenuePerModule: number | null;
  averageModulesPerOrder: number | null;
  moduleRevenue: ModuleRevenue;
  sourceMonth: string | null;
};

type ShopifyMoneySet = {
  shopMoney?: {
    amount?: string | null;
    currencyCode?: string | null;
  } | null;
};

type ShopifyRawLineItem = {
  discountedTotalSet?: ShopifyMoneySet | null;
  originalTotalSet?: ShopifyMoneySet | null;
  quantity?: number | null;
  sku?: string | null;
  title?: string | null;
  variantTitle?: string | null;
};

type ShopifyRawOrder = {
  lineItems?: {
    edges?: Array<{
      node?: ShopifyRawLineItem | null;
    } | null> | null;
  } | null;
};

const emptyModuleBreakdown = (): ModuleBreakdown => ({
  armless: 0,
  corner: 0,
  ottoman: 0
});

function addModuleBreakdown(left: ModuleBreakdown, right: ModuleBreakdown) {
  return {
    armless: left.armless + right.armless,
    corner: left.corner + right.corner,
    ottoman: left.ottoman + right.ottoman
  };
}

function subtractModuleBreakdown(left: ModuleBreakdown, right: ModuleBreakdown) {
  return {
    armless: Math.max(0, left.armless - right.armless),
    corner: Math.max(0, left.corner - right.corner),
    ottoman: Math.max(0, left.ottoman - right.ottoman)
  };
}

function totalModuleBreakdown(breakdown: ModuleBreakdown) {
  return breakdown.armless + breakdown.corner + breakdown.ottoman;
}

function normalizeModuleSlug(value?: string | null): ModuleSlug | null {
  const normalized = (value || "").toLowerCase().trim();
  if (normalized.includes("corner") || normalized === "cor") return "corner";
  if (normalized.includes("armless") || normalized.includes("side") || normalized === "side") return "armless";
  if (normalized.includes("ottoman") || normalized === "ott") return "ottoman";
  return null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string | null) {
  if (!month) return "Imported orders";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
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
  const firstPlanningDate = new Date(today.getFullYear(), today.getMonth(), 1);
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

function containerModuleBreakdown(container: ContainerEntry) {
  return (container.manifest_json || []).reduce<ModuleBreakdown>((sum, item) => {
    const moduleSlug = normalizeModuleSlug(item.module);
    if (!moduleSlug) return sum;
    return {
      ...sum,
      [moduleSlug]: sum[moduleSlug] + Number(item.quantity || 0)
    };
  }, emptyModuleBreakdown());
}

function netAvailableInventory(row: Pick<InventoryRow, "available_qty" | "reserved_qty">) {
  return Math.max(0, Number(row.available_qty || 0) - Number(row.reserved_qty || 0));
}

function inventoryModuleBreakdown(rows: Pick<InventoryRow, "available_qty" | "module_slug" | "reserved_qty">[]) {
  return rows.reduce<ModuleBreakdown>((sum, row) => {
    const moduleSlug = normalizeModuleSlug(row.module_slug);
    if (!moduleSlug) return sum;
    return {
      ...sum,
      [moduleSlug]: sum[moduleSlug] + netAvailableInventory(row)
    };
  }, emptyModuleBreakdown());
}

function isInboundDemandContainer(container: ContainerEntry) {
  return container.status !== "closed";
}

function lineItemModule(lineItem: ShopifyRawLineItem) {
  return normalizeModuleSlug([lineItem.title, lineItem.variantTitle, lineItem.sku].filter(Boolean).join(" "));
}

function lineItemRevenue(lineItem: ShopifyRawLineItem) {
  const money =
    lineItem.discountedTotalSet?.shopMoney ||
    lineItem.originalTotalSet?.shopMoney ||
    null;
  const amount = Number(money?.amount || 0);
  const currency = money?.currencyCode || "CAD";

  if (!Number.isFinite(amount) || amount <= 0 || currency.toUpperCase() !== "CAD") {
    return null;
  }

  return amount;
}

function orderRawLineItems(order: ShopifyOrder) {
  const rawOrder = order.raw_shopify_json as ShopifyRawOrder | null;
  return (rawOrder?.lineItems?.edges || [])
    .map((edge) => edge?.node || null)
    .filter((node): node is ShopifyRawLineItem => Boolean(node));
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
    ? revenueOrders(orders).filter((order) => new Date(order.created_at) >= firstMetaDate)
    : revenueOrders(orders);
  const totalMetaSpend = cadMetaExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    metaSpend: totalMetaSpend,
    orderCount: ordersInWindow.length,
    value: ordersInWindow.length === 0 || totalMetaSpend <= 0 ? null : totalMetaSpend / ordersInWindow.length
  };
}

function hasRevenuePaymentStatus(order: ShopifyOrder) {
  if (!order.payment_status) return true;
  return revenuePaymentStatuses.has(order.payment_status.toUpperCase());
}

function hasCadRevenueCurrency(order: ShopifyOrder) {
  if (!order.currency) return true;
  return order.currency.toUpperCase() === "CAD";
}

function revenueOrders(orders: ShopifyOrder[]) {
  return orders.filter((order) =>
    Number(order.total_price || 0) > 0 &&
    hasCadRevenueCurrency(order) &&
    hasRevenuePaymentStatus(order)
  );
}

function moduleOrders(orders: ShopifyOrder[]) {
  return revenueOrders(orders).filter((order) => Number(order.total_modules || 0) > 0);
}

function calculateShopifyProjectionMetrics(orders: ShopifyOrder[]): ShopifyProjectionMetrics {
  const paidRevenueOrders = revenueOrders(orders);
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const completedRevenueOrders = paidRevenueOrders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt < currentMonthStart;
  });
  const monthlyOrderGroups = new Map<string, ShopifyOrder[]>();

  for (const order of completedRevenueOrders) {
    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;
    const month = dateKey(createdAt);
    monthlyOrderGroups.set(month, [...(monthlyOrderGroups.get(month) || []), order]);
  }

  const latestCompletedMonth = [...monthlyOrderGroups.keys()].sort().at(-1) || null;
  const sourceOrders = latestCompletedMonth ? monthlyOrderGroups.get(latestCompletedMonth) || [] : paidRevenueOrders;
  const sourceModuleOrders = moduleOrders(sourceOrders);
  const totalRevenue = sourceModuleOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const totalModules = sourceModuleOrders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const moduleRevenueTotals = emptyModuleBreakdown();
  const moduleQuantityTotals = emptyModuleBreakdown();

  for (const order of sourceModuleOrders) {
    for (const lineItem of orderRawLineItems(order)) {
      const moduleSlug = lineItemModule(lineItem);
      const quantity = Number(lineItem.quantity || 0);
      const revenue = lineItemRevenue(lineItem);

      if (!moduleSlug || !Number.isFinite(quantity) || quantity <= 0 || revenue === null) continue;

      moduleRevenueTotals[moduleSlug] += revenue;
      moduleQuantityTotals[moduleSlug] += quantity;
    }
  }

  return {
    averageRevenuePerModule: totalModules > 0 && totalRevenue > 0 ? totalRevenue / totalModules : null,
    averageModulesPerOrder: sourceModuleOrders.length > 0 && totalModules > 0 ? totalModules / sourceModuleOrders.length : null,
    moduleRevenue: {
      armless: moduleQuantityTotals.armless > 0 ? moduleRevenueTotals.armless / moduleQuantityTotals.armless : null,
      corner: moduleQuantityTotals.corner > 0 ? moduleRevenueTotals.corner / moduleQuantityTotals.corner : null,
      ottoman: moduleQuantityTotals.ottoman > 0 ? moduleRevenueTotals.ottoman / moduleQuantityTotals.ottoman : null
    },
    sourceMonth: latestCompletedMonth
  };
}

function maxRevenueFromModuleMix(
  modules: ModuleBreakdown,
  moduleRevenue: ModuleRevenue,
  fallbackRevenuePerModule: number | null
) {
  const missingValue = (Object.keys(modules) as ModuleSlug[]).some((module) =>
    modules[module] > 0 && moduleRevenue[module] === null && fallbackRevenuePerModule === null
  );
  if (missingValue) return null;

  return (Object.keys(modules) as ModuleSlug[]).reduce((sum, module) => {
    return sum + modules[module] * (moduleRevenue[module] ?? fallbackRevenuePerModule ?? 0);
  }, 0);
}

function proportionalModuleBreakdown(modules: ModuleBreakdown, requestedModules: number) {
  const availableModules = totalModuleBreakdown(modules);
  if (availableModules <= 0 || requestedModules <= 0) return emptyModuleBreakdown();

  const scale = Math.min(1, requestedModules / availableModules);
  const targetModules = Math.min(availableModules, Math.floor(requestedModules));
  const base = {
    armless: Math.min(modules.armless, Math.floor(modules.armless * scale)),
    corner: Math.min(modules.corner, Math.floor(modules.corner * scale)),
    ottoman: Math.min(modules.ottoman, Math.floor(modules.ottoman * scale))
  };
  let remaining = targetModules - totalModuleBreakdown(base);
  const order: ModuleSlug[] = ["corner", "armless", "ottoman"];

  while (remaining > 0) {
    const nextModule = order.find((module) => base[module] < modules[module]);
    if (!nextModule) break;
    base[nextModule] += 1;
    remaining -= 1;
  }

  return base;
}

function monthOptionFromDate(date: Date): MonthOption {
  const month = dateKey(date);
  const { end, start } = monthBounds(month);

  return {
    end,
    href: `/demand?month=${month}`,
    isActive: false,
    label: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(start),
    month,
    start
  };
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthRange(firstMonth: string, lastMonth: string) {
  const [firstYear, firstMonthNumber] = firstMonth.split("-").map(Number);
  const [lastYear, lastMonthNumber] = lastMonth.split("-").map(Number);
  const months: MonthOption[] = [];
  let date = new Date(firstYear, firstMonthNumber - 1, 1);
  const endDate = new Date(lastYear, lastMonthNumber - 1, 1);

  while (date <= endDate) {
    months.push(monthOptionFromDate(date));
    date = addMonths(date, 1);
  }

  return months;
}

function containerIncomingForMonth(containerDemand: ContainerDemand[], month: MonthOption) {
  return containerDemand.reduce((sum, item) => {
    if (!item.eta || item.eta < month.start || item.eta > month.end) return sum;
    return addModuleBreakdown(sum, item.breakdown);
  }, emptyModuleBreakdown());
}

function autoSaleWindows(month: MonthOption, saleDurationDays: number, maxDaysBetweenSales: number) {
  const safeDuration = Math.max(1, saleDurationDays);
  const safeGap = Math.max(0, maxDaysBetweenSales);
  const windows: Date[][] = [];

  for (let startDay = 1; startDay <= month.end.getDate(); startDay += safeDuration + safeGap) {
    const endDay = Math.min(month.end.getDate(), startDay + safeDuration - 1);
    const dates: Date[] = [];

    for (let day = startDay; day <= endDay; day += 1) {
      dates.push(new Date(month.start.getFullYear(), month.start.getMonth(), day));
    }

    windows.push(dates);
  }

  return windows;
}

function containerEligibleBySaleDate(containerDemand: ContainerDemand[], month: MonthOption, saleDate: Date, sellBeforeEtaDays: number) {
  const lastEligibleEta = addDays(saleDate, sellBeforeEtaDays);

  return containerDemand.reduce<ModuleBreakdown>((sum, item) => {
    if (!item.eta || item.eta < month.start || item.eta > month.end || item.eta > lastEligibleEta) return sum;
    return addModuleBreakdown(sum, item.breakdown);
  }, emptyModuleBreakdown());
}

function plannedSoldForAutoSales({
  averageModulesPerOrder,
  containerDemand,
  customerAcquisitionCost,
  maxDailyAdSpend,
  month,
  sellBeforeEtaDays,
  startingInventory
}: {
  averageModulesPerOrder: number | null;
  containerDemand: ContainerDemand[];
  customerAcquisitionCost: number | null;
  maxDailyAdSpend: number;
  month: MonthOption;
  sellBeforeEtaDays: number;
  startingInventory: ModuleBreakdown;
}) {
  let soldByType = emptyModuleBreakdown();
  let plannedAdSpend = 0;
  let plannedOrders = 0;

  if (
    !averageModulesPerOrder ||
    averageModulesPerOrder <= 0 ||
    !customerAcquisitionCost ||
    customerAcquisitionCost <= 0 ||
    maxDailyAdSpend <= 0
  ) {
    return {
      adSpend: 0,
      modules: soldByType,
      orders: 0
    };
  }

  for (const window of autoSaleWindows(month, defaultSaleDurationDays, defaultMaxDaysApart)) {
    for (const saleDate of window) {
      const eligibleIncoming = containerEligibleBySaleDate(containerDemand, month, saleDate, sellBeforeEtaDays);
      const availableByType = subtractModuleBreakdown(addModuleBreakdown(startingInventory, eligibleIncoming), soldByType);
      const maxOrdersBySpend = Math.floor(maxDailyAdSpend / customerAcquisitionCost);
      const requestedModules = maxOrdersBySpend * averageModulesPerOrder;
      const modules = proportionalModuleBreakdown(availableByType, requestedModules);
      const modulesSold = totalModuleBreakdown(modules);

      if (modulesSold <= 0) continue;

      const orders = Math.ceil(modulesSold / averageModulesPerOrder);
      const spend = Math.min(maxDailyAdSpend, orders * customerAcquisitionCost);

      plannedAdSpend += spend;
      plannedOrders += orders;
      soldByType = addModuleBreakdown(soldByType, modules);
    }
  }

  return {
    adSpend: plannedAdSpend,
    modules: soldByType,
    orders: plannedOrders
  };
}

function calculateDemandPlan({
  containers,
  customerAcquisitionCost,
  orders,
  selectedMonth,
  vancouverOnHandBreakdown
}: {
  containers: ContainerEntry[];
  customerAcquisitionCost: number | null;
  orders: ShopifyOrder[];
  selectedMonth: MonthOption;
  vancouverOnHandBreakdown: ModuleBreakdown;
}): DemandPlan {
  const shopifyProjectionMetrics = calculateShopifyProjectionMetrics(orders);
  const averageModulesPerOrder = shopifyProjectionMetrics.averageModulesPerOrder;
  const activeContainers = containers.filter((container) => container.status !== "closed");
  const inboundDemandContainers = activeContainers.filter(isInboundDemandContainer);
  const containerDemand = inboundDemandContainers
    .map((container) => {
      const eta = getContainerEta(container);
      const breakdown = containerModuleBreakdown(container);
      return {
        breakdown,
        eta,
        pieces: totalModuleBreakdown(breakdown)
      };
    })
    .filter((container) => container.pieces > 0)
    .sort((left, right) => (left.eta?.getTime() || Number.MAX_SAFE_INTEGER) - (right.eta?.getTime() || Number.MAX_SAFE_INTEGER));
  const firstPlanningMonth = dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  let startingInventoryByType = vancouverOnHandBreakdown;
  let incomingModulesByType = emptyModuleBreakdown();
  let plannedSoldByType = emptyModuleBreakdown();
  let plannedAdSpend = 0;
  let plannedOrders = 0;
  let endingInventoryByType = vancouverOnHandBreakdown;

  for (const month of monthRange(firstPlanningMonth, selectedMonth.month)) {
    startingInventoryByType = endingInventoryByType;
    incomingModulesByType = containerIncomingForMonth(containerDemand, month);
    const plannedSale = plannedSoldForAutoSales({
      averageModulesPerOrder,
      containerDemand,
      customerAcquisitionCost,
      maxDailyAdSpend: defaultDailyAdBudget,
      month,
      sellBeforeEtaDays: defaultSellBeforeEtaDays,
      startingInventory: startingInventoryByType
    });

    plannedAdSpend = plannedSale.adSpend;
    plannedOrders = plannedSale.orders;
    plannedSoldByType = plannedSale.modules;
    endingInventoryByType = subtractModuleBreakdown(addModuleBreakdown(startingInventoryByType, incomingModulesByType), plannedSoldByType);
  }

  const targetModulesByType = endingInventoryByType;
  const targetModulesToSell = totalModuleBreakdown(targetModulesByType);

  return {
    averageRevenuePerModule: shopifyProjectionMetrics.averageRevenuePerModule,
    averageModulesPerOrder,
    customerAcquisitionCost,
    incomingContainers: containerDemand.map((container) => ({
      breakdown: container.breakdown,
      eta: container.eta ? dateInputValue(container.eta) : null,
      pieces: container.pieces
    })),
    incomingModulesByType,
    maxRevenue: maxRevenueFromModuleMix(
      plannedSoldByType,
      shopifyProjectionMetrics.moduleRevenue,
      shopifyProjectionMetrics.averageRevenuePerModule
    ),
    moduleRevenue: shopifyProjectionMetrics.moduleRevenue,
    plannedSoldByType,
    selectedMonth,
    shopifyProjectionMonth: shopifyProjectionMetrics.sourceMonth,
    targetModulesByType,
    targetMetaBudget: plannedAdSpend,
    targetModulesToSell,
    targetOrdersToSell: plannedOrders,
    totalActiveInboundModules: totalModuleBreakdown(incomingModulesByType),
    eligibleInboundByType: incomingModulesByType,
    plannedSoldBeforeMonthByType: plannedSoldByType,
    vancouverOnHandByType: startingInventoryByType,
    vancouverOnHand: totalModuleBreakdown(startingInventoryByType)
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
    defaultSale: {
      averageRevenuePerModule: plan.averageRevenuePerModule,
      averageModulesPerOrder: plan.averageModulesPerOrder,
      customerAcquisitionCost: plan.customerAcquisitionCost,
      defaultDailyAdBudget,
      incomingContainers: plan.incomingContainers,
      maxRevenue: plan.maxRevenue,
      moduleRevenue: plan.moduleRevenue,
      modules: plan.targetModulesToSell,
      modulesByType: plan.targetModulesByType,
      orders: plan.targetOrdersToSell,
      shopifyProjectionMonth: monthLabel(plan.shopifyProjectionMonth),
      totalActiveInboundModules: plan.totalActiveInboundModules,
      eligibleInboundByType: plan.eligibleInboundByType,
      plannedSoldBeforeMonthByType: plan.plannedSoldBeforeMonthByType,
      totalBudget: plan.targetMetaBudget,
      vancouverOnHandByType: plan.vancouverOnHandByType,
      vancouverOnHand: plan.vancouverOnHand
    },
    monthLabel: plan.selectedMonth.label,
    saleEvents: [],
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
  const { profile, supabase } = await requireUser();
  const [
    { data: inventoryRows, error: inventoryError },
    { data: orders },
    { data: containers },
    wiseSummary
  ] = await Promise.all([
    supabase
      .from("inventory")
      .select("available_qty,module_slug,reserved_qty")
      .returns<Pick<InventoryRow, "available_qty" | "module_slug" | "reserved_qty">[]>(),
    supabase
      .from("shopify_orders")
      .select("created_at,total_modules,total_price,payment_status,currency,corner_qty,armless_qty,ottoman_qty,raw_shopify_json")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<ShopifyOrder[]>(),
    supabase
      .from("container_entries")
      .select("*")
      .order("eta", { ascending: true, nullsFirst: false })
      .returns<ContainerEntry[]>(),
    getCachedWiseSummary()
  ]);

  const vancouverOnHandBreakdown = inventoryModuleBreakdown(inventoryRows || []);
  const customerAcquisitionCost = calculateCustomerAcquisitionCost({
    metaExpenses: wiseSummary.metaSpend.expenses,
    orders: orders || []
  });
  const plan = calculateDemandPlan({
    containers: containers || [],
    customerAcquisitionCost: customerAcquisitionCost.value,
    orders: orders || [],
    selectedMonth,
    vancouverOnHandBreakdown
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
          <DemandSaleCalendar canEdit={canUpdateOrderLogistics(profile?.role)} plan={toCalendarPlan(plan)} />
        </div>
      )}
    </main>
  );
}
