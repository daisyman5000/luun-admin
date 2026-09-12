"use client";

import { useState } from "react";

export type DemandCalendarEvent = {
  dailyBudget: number | null;
  date: string;
  days: {
    date: string;
    id: string;
  }[];
  endDate: string;
  labels: string[];
  modules: number;
  orders: number | null;
  totalBudget: number | null;
};

type ModuleSlug = "corner" | "armless" | "ottoman";
type ModuleBreakdown = Record<ModuleSlug, number>;
type ModuleRevenue = Record<ModuleSlug, number | null>;

type IncomingContainer = {
  breakdown: ModuleBreakdown;
  eta: string | null;
  pieces: number;
};

type AutoSaleDay = {
  date: string;
  modules: ModuleBreakdown;
  orders: number;
  spend: number;
};

export type DemandCalendarPlan = {
  defaultSale: {
    averageRevenuePerModule: number | null;
    averageModulesPerOrder: number | null;
    customerAcquisitionCost: number | null;
    defaultDailyAdBudget: number;
    eligibleInboundByType: ModuleBreakdown;
    incomingContainers: IncomingContainer[];
    maxRevenue: number | null;
    moduleRevenue: ModuleRevenue;
    modules: number;
    modulesByType: ModuleBreakdown;
    orders: number | null;
    plannedSoldBeforeMonthByType: ModuleBreakdown;
    shopifyProjectionMonth: string;
    totalActiveInboundModules: number;
    totalBudget: number | null;
    vancouverOnHand: number;
    vancouverOnHandByType: ModuleBreakdown;
  };
  monthLabel: string;
  saleEvents: DemandCalendarEvent[];
  selectedMonth: {
    endDay: number;
    firstDay: number;
    month: string;
  };
};

const emptyModules = (): ModuleBreakdown => ({
  armless: 0,
  corner: 0,
  ottoman: 0
});

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function wholeNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function dayKey(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function dateFromKey(date: string) {
  return new Date(`${date}T00:00:00`);
}

function addDaysToKey(date: string, days: number) {
  const nextDate = dateFromKey(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

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

function totalBreakdown(breakdown: ModuleBreakdown) {
  return breakdown.corner + breakdown.armless + breakdown.ottoman;
}

function proportionalModuleBreakdown(modules: ModuleBreakdown, requestedModules: number) {
  const availableModules = totalBreakdown(modules);
  if (availableModules <= 0 || requestedModules <= 0) return emptyModules();

  const scale = Math.min(1, requestedModules / availableModules);
  const targetModules = Math.min(availableModules, Math.floor(requestedModules));
  const base = {
    armless: Math.min(modules.armless, Math.floor(modules.armless * scale)),
    corner: Math.min(modules.corner, Math.floor(modules.corner * scale)),
    ottoman: Math.min(modules.ottoman, Math.floor(modules.ottoman * scale))
  };
  let remaining = targetModules - totalBreakdown(base);
  const order: ModuleSlug[] = ["corner", "armless", "ottoman"];

  while (remaining > 0) {
    const nextModule = order.find((module) => base[module] < modules[module]);
    if (!nextModule) break;
    base[nextModule] += 1;
    remaining -= 1;
  }

  return base;
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

function moduleBreakdownText(breakdown: ModuleBreakdown) {
  return [
    `${wholeNumber(breakdown.corner)} corner`,
    `${wholeNumber(breakdown.armless)} armless`,
    `${wholeNumber(breakdown.ottoman)} ottoman`
  ].join(" / ");
}

function revenueBreakdownText(moduleRevenue: ModuleRevenue) {
  return (["corner", "armless", "ottoman"] as ModuleSlug[])
    .map((module) => `${module}: ${moduleRevenue[module] === null ? "missing" : money(moduleRevenue[module])}`)
    .join(" / ");
}

function autoSaleDates(month: string, endDay: number, maxDaysApart: number) {
  const safeGap = Math.max(1, maxDaysApart);
  const dates: string[] = [];

  for (let day = 1; day <= endDay; day += safeGap) {
    dates.push(dayKey(month, day));
  }

  return dates;
}

function incomingEligibleByDate(
  containers: IncomingContainer[],
  month: string,
  monthEnd: string,
  saleDate: string,
  sellBeforeEtaDays: number
) {
  const monthStart = `${month}-01`;
  const lastEligibleEta = addDaysToKey(saleDate, sellBeforeEtaDays);

  return containers.reduce<ModuleBreakdown>((sum, container) => {
    if (!container.eta || container.eta < monthStart || container.eta > monthEnd || container.eta > lastEligibleEta) return sum;
    return addModuleBreakdown(sum, container.breakdown);
  }, emptyModules());
}

function simulateAutoSales({
  averageModulesPerOrder,
  containers,
  customerAcquisitionCost,
  dates,
  maxDailyAdSpend,
  moduleRevenue,
  month,
  monthEnd,
  sellBeforeEtaDays,
  startingInventory,
  fallbackRevenuePerModule
}: {
  averageModulesPerOrder: number | null;
  containers: IncomingContainer[];
  customerAcquisitionCost: number | null;
  dates: string[];
  fallbackRevenuePerModule: number | null;
  maxDailyAdSpend: number;
  moduleRevenue: ModuleRevenue;
  month: string;
  monthEnd: string;
  sellBeforeEtaDays: number;
  startingInventory: ModuleBreakdown;
}) {
  let soldByType = emptyModules();
  const saleDays: AutoSaleDay[] = [];

  for (const date of dates) {
    if (
      !averageModulesPerOrder ||
      averageModulesPerOrder <= 0 ||
      !customerAcquisitionCost ||
      customerAcquisitionCost <= 0 ||
      maxDailyAdSpend <= 0
    ) {
      continue;
    }

    const eligibleIncoming = incomingEligibleByDate(containers, month, monthEnd, date, sellBeforeEtaDays);
    const availableByType = subtractModuleBreakdown(addModuleBreakdown(startingInventory, eligibleIncoming), soldByType);
    const maxOrdersBySpend = Math.floor(maxDailyAdSpend / customerAcquisitionCost);
    const requestedModules = maxOrdersBySpend * averageModulesPerOrder;
    const modules = proportionalModuleBreakdown(availableByType, requestedModules);
    const modulesSold = totalBreakdown(modules);

    if (modulesSold <= 0) continue;

    const orders = Math.ceil(modulesSold / averageModulesPerOrder);
    const spend = Math.min(maxDailyAdSpend, orders * customerAcquisitionCost);

    saleDays.push({
      date,
      modules,
      orders,
      spend
    });

    soldByType = addModuleBreakdown(soldByType, modules);
  }

  const totalSpend = saleDays.reduce((sum, day) => sum + day.spend, 0);
  const totalOrders = saleDays.reduce((sum, day) => sum + day.orders, 0);
  const revenue = maxRevenueFromModuleMix(soldByType, moduleRevenue, fallbackRevenuePerModule);

  return {
    revenue,
    saleDays,
    soldByType,
    totalOrders,
    totalSpend
  };
}

function Stat({
  label,
  tone = "plain",
  value
}: {
  label: string;
  tone?: "plain" | "strong";
  value: string;
}) {
  return (
    <div className={tone === "strong" ? "rounded-2xl border border-blue-200 bg-blue-50 p-4" : "rounded-2xl border border-line bg-white p-4"}>
      <p className={tone === "strong" ? "text-xs font-semibold uppercase tracking-normal text-blue-700" : "text-xs font-semibold uppercase tracking-normal text-slate-500"}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function DemandSaleCalendar({ plan }: { canEdit: boolean; plan: DemandCalendarPlan }) {
  const [maxDailyAdSpend, setMaxDailyAdSpend] = useState(plan.defaultSale.defaultDailyAdBudget);
  const [maxDaysApart, setMaxDaysApart] = useState(3);
  const [sellBeforeEtaDays, setSellBeforeEtaDays] = useState(0);

  const dates = autoSaleDates(plan.selectedMonth.month, plan.selectedMonth.endDay, maxDaysApart);
  const monthEnd = dayKey(plan.selectedMonth.month, plan.selectedMonth.endDay);
  const simulation = simulateAutoSales({
    averageModulesPerOrder: plan.defaultSale.averageModulesPerOrder,
    containers: plan.defaultSale.incomingContainers,
    customerAcquisitionCost: plan.defaultSale.customerAcquisitionCost,
    dates,
    fallbackRevenuePerModule: plan.defaultSale.averageRevenuePerModule,
    maxDailyAdSpend,
    moduleRevenue: plan.defaultSale.moduleRevenue,
    month: plan.selectedMonth.month,
    monthEnd,
    sellBeforeEtaDays,
    startingInventory: plan.defaultSale.vancouverOnHandByType
  });
  const monthInventoryByType = addModuleBreakdown(plan.defaultSale.vancouverOnHandByType, plan.defaultSale.eligibleInboundByType);
  const endingInventoryByType = subtractModuleBreakdown(monthInventoryByType, simulation.soldByType);
  const saleDaysByDate = new Map(simulation.saleDays.map((day) => [day.date, day]));
  const cells = [
    ...Array.from({ length: plan.selectedMonth.firstDay }, (_, index) => ({ day: null, key: `blank-${index}` })),
    ...Array.from({ length: plan.selectedMonth.endDay }, (_, index) => {
      const day = index + 1;
      return { day, key: dayKey(plan.selectedMonth.month, day) };
    })
  ];

  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Demand plan</h2>
          <p className="text-sm text-slate-500">
            Starting inventory plus containers arriving this month, minus auto-placed sale inventory.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-line bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Inventory equation</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <Stat label="Starting inventory" value={wholeNumber(plan.defaultSale.vancouverOnHand)} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">+</div>
          <Stat label="Incoming containers" value={wholeNumber(plan.defaultSale.totalActiveInboundModules)} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">-</div>
          <Stat label="Auto planned to sell" value={wholeNumber(totalBreakdown(simulation.soldByType))} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">=</div>
          <Stat label="Ending inventory" tone="strong" value={wholeNumber(totalBreakdown(endingInventoryByType))} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Max daily ad spend</span>
              <span className="text-lg font-semibold text-slate-950">{money(maxDailyAdSpend)}</span>
            </div>
            <input
              className="mt-3 w-full accent-blue-600"
              max={5000}
              min={0}
              onChange={(event) => setMaxDailyAdSpend(Number(event.target.value))}
              step={50}
              type="range"
              value={maxDailyAdSpend}
            />
          </label>
          <label className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Max days between sales</span>
              <span className="text-lg font-semibold text-slate-950">{maxDaysApart} days</span>
            </div>
            <input
              className="mt-3 w-full accent-blue-600"
              max={14}
              min={1}
              onChange={(event) => setMaxDaysApart(Number(event.target.value))}
              step={1}
              type="range"
              value={maxDaysApart}
            />
          </label>
          <label className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sell before ETA</span>
              <span className="text-lg font-semibold text-slate-950">{sellBeforeEtaDays} days</span>
            </div>
            <input
              className="mt-3 w-full accent-blue-600"
              max={45}
              min={0}
              onChange={(event) => setSellBeforeEtaDays(Number(event.target.value))}
              step={1}
              type="range"
              value={sellBeforeEtaDays}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Starting mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(plan.defaultSale.vancouverOnHandByType)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Incoming mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(plan.defaultSale.eligibleInboundByType)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Auto planned to sell</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(simulation.soldByType)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Ending mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(endingInventoryByType)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sale days" value={wholeNumber(simulation.saleDays.length)} />
        <Stat label="Expected orders" value={wholeNumber(simulation.totalOrders)} />
        <Stat label="Revenue" tone="strong" value={simulation.revenue === null ? "Unavailable" : money(simulation.revenue)} />
        <Stat label="Ad budget" value={money(simulation.totalSpend)} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-950">
          Average modules/order: {plan.defaultSale.averageModulesPerOrder === null ? "Unavailable" : plan.defaultSale.averageModulesPerOrder.toFixed(1)}
        </span>
        <span className="mx-2 text-slate-300">|</span>
        <span>
          CAC: {plan.defaultSale.customerAcquisitionCost === null ? "Unavailable" : money(plan.defaultSale.customerAcquisitionCost)}
        </span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Source month: {plan.defaultSale.shopifyProjectionMonth}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Module revenue: {revenueBreakdownText(plan.defaultSale.moduleRevenue)}</span>
      </div>

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-950">Auto sale calendar</h3>
        <p className="text-xs font-medium text-slate-500">
          Sale days are auto-spaced by the max gap and each day is capped by max daily ad spend.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const saleDay = saleDaysByDate.get(cell.key);

          return (
            <div
              className={[
                "min-h-24 rounded-xl border p-2 text-left text-sm transition",
                cell.day ? "border-line bg-slate-50" : "border-transparent",
                saleDay ? "border-blue-200 bg-blue-50 shadow-sm" : ""
              ].join(" ")}
              key={cell.key}
            >
              {cell.day ? (
                <>
                  <div className="font-semibold text-slate-700">{cell.day}</div>
                  {saleDay ? (
                    <div className="mt-3 rounded-lg bg-white p-2 text-xs leading-5">
                      <div className="font-semibold text-blue-700">Auto sale</div>
                      <div className="text-slate-500">{money(saleDay.spend)} ads</div>
                      <div className="text-slate-500">{wholeNumber(saleDay.orders)} orders</div>
                      <div className="font-semibold text-slate-700">{wholeNumber(totalBreakdown(saleDay.modules))} modules</div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
