"use client";

import { useEffect, useState } from "react";

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
  windowIndex: number;
};

type AutoSaleWindow = {
  days: AutoSaleDay[];
  endDate: string;
  startDate: string;
};

type DemandMonthSettings = {
  maxDailyAdSpend: number;
  maxDaysApart: number;
  saleDurationDays: number;
  saleStartDay: number;
};

export type DemandCalendarPlan = {
  defaultSale: {
    averageRevenuePerModule: number | null;
    averageModulesPerOrder: number | null;
    baseVancouverOnHandByType: ModuleBreakdown;
    customerAcquisitionCost: number | null;
    defaultDailyAdBudget: number;
    eligibleInboundByType: ModuleBreakdown;
    firstPlanningMonth: string;
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
const monthSettingsStorageKey = "luun-demand-month-settings";

function defaultMonthSettings(defaultDailyAdBudget: number): DemandMonthSettings {
  return {
    maxDailyAdSpend: defaultDailyAdBudget,
    maxDaysApart: 3,
    saleDurationDays: 10,
    saleStartDay: 1
  };
}

function clampMonthSettings(settings: DemandMonthSettings, endDay: number): DemandMonthSettings {
  return {
    maxDailyAdSpend: Math.min(5000, Math.max(0, settings.maxDailyAdSpend)),
    maxDaysApart: Math.min(14, Math.max(1, settings.maxDaysApart)),
    saleDurationDays: Math.min(21, Math.max(1, settings.saleDurationDays)),
    saleStartDay: Math.min(endDay, Math.max(1, settings.saleStartDay))
  };
}

function readMonthSettings() {
  if (typeof window === "undefined") return {};

  try {
    const storedSettings = window.localStorage.getItem(monthSettingsStorageKey);
    return storedSettings ? JSON.parse(storedSettings) as Record<string, Partial<DemandMonthSettings>> : {};
  } catch {
    return {};
  }
}

function settingsForMonth({
  defaultDailyAdBudget,
  endDay,
  month,
  override,
  settingsByMonth
}: {
  defaultDailyAdBudget: number;
  endDay: number;
  month: string;
  override?: DemandMonthSettings;
  settingsByMonth: Record<string, Partial<DemandMonthSettings>>;
}) {
  return clampMonthSettings({
    ...defaultMonthSettings(defaultDailyAdBudget),
    ...settingsByMonth[month],
    ...override
  }, endDay);
}

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

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(dateFromKey(date));
}

function monthEndDay(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function addMonthsToKey(month: string, months: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBetween(firstMonth: string, lastMonth: string) {
  const months: string[] = [];
  let month = firstMonth;

  while (month <= lastMonth) {
    months.push(month);
    month = addMonthsToKey(month, 1);
  }

  return months;
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
    armless: left.armless - right.armless,
    corner: left.corner - right.corner,
    ottoman: left.ottoman - right.ottoman
  };
}

function totalBreakdown(breakdown: ModuleBreakdown) {
  return breakdown.corner + breakdown.armless + breakdown.ottoman;
}

function positiveModuleTotal(modules: ModuleBreakdown) {
  return Math.max(0, modules.corner) + Math.max(0, modules.armless) + Math.max(0, modules.ottoman);
}

function demandModuleBreakdown(modules: ModuleBreakdown, requestedModules: number) {
  const basisModules = positiveModuleTotal(modules);
  const targetModules = Math.max(0, Math.floor(requestedModules));
  if (targetModules <= 0) return emptyModules();

  if (basisModules <= 0) {
    const baseEach = Math.floor(targetModules / 3);
    const remainder = targetModules - baseEach * 3;
    return {
      armless: baseEach + (remainder > 1 ? 1 : 0),
      corner: baseEach + (remainder > 0 ? 1 : 0),
      ottoman: baseEach
    };
  }

  const base = {
    armless: Math.floor((Math.max(0, modules.armless) / basisModules) * targetModules),
    corner: Math.floor((Math.max(0, modules.corner) / basisModules) * targetModules),
    ottoman: Math.floor((Math.max(0, modules.ottoman) / basisModules) * targetModules)
  };
  let remaining = targetModules - totalBreakdown(base);
  const order: ModuleSlug[] = ["corner", "armless", "ottoman"];

  while (remaining > 0) {
    const nextModule = order.find((module) => Math.max(0, modules[module]) > 0) || order[0];
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

function autoSaleWindows(month: string, endDay: number, saleStartDay: number, saleDurationDays: number, maxDaysBetweenSales: number) {
  const safeStartDay = Math.min(endDay, Math.max(1, saleStartDay));
  const safeDuration = Math.max(1, saleDurationDays);
  const safeGap = Math.max(0, maxDaysBetweenSales);
  const windows: { dates: string[]; endDate: string; startDate: string }[] = [];

  for (let startDay = safeStartDay; startDay <= endDay; startDay += safeDuration + safeGap) {
    const endWindowDay = Math.min(endDay, startDay + safeDuration - 1);
    const dates: string[] = [];

    for (let day = startDay; day <= endWindowDay; day += 1) {
      dates.push(dayKey(month, day));
    }

    windows.push({
      dates,
      endDate: dayKey(month, endWindowDay),
      startDate: dayKey(month, startDay)
    });
  }

  return windows;
}

function simulateAutoSales({
  averageModulesPerOrder,
  customerAcquisitionCost,
  demandMix,
  maxDailyAdSpend,
  moduleRevenue,
  fallbackRevenuePerModule,
  windows
}: {
  averageModulesPerOrder: number | null;
  customerAcquisitionCost: number | null;
  demandMix: ModuleBreakdown;
  fallbackRevenuePerModule: number | null;
  maxDailyAdSpend: number;
  moduleRevenue: ModuleRevenue;
  windows: { dates: string[]; endDate: string; startDate: string }[];
}) {
  let soldByType = emptyModules();
  const saleDays: AutoSaleDay[] = [];
  const saleWindows: AutoSaleWindow[] = [];

  for (const [windowIndex, window] of windows.entries()) {
    const windowDays: AutoSaleDay[] = [];

    if (
      !averageModulesPerOrder ||
      averageModulesPerOrder <= 0 ||
      !customerAcquisitionCost ||
      customerAcquisitionCost <= 0 ||
      maxDailyAdSpend <= 0
    ) {
      continue;
    }

    for (const date of window.dates) {
      const maxOrdersBySpend = Math.floor(maxDailyAdSpend / customerAcquisitionCost);
      const requestedModules = maxOrdersBySpend * averageModulesPerOrder;
      const modules = demandModuleBreakdown(demandMix, requestedModules);
      const modulesSold = totalBreakdown(modules);

      if (modulesSold <= 0) continue;

      const orders = Math.ceil(modulesSold / averageModulesPerOrder);
      const spend = Math.min(maxDailyAdSpend, orders * customerAcquisitionCost);
      const saleDay = {
        date,
        modules,
        orders,
        spend,
        windowIndex
      };

      saleDays.push(saleDay);
      windowDays.push(saleDay);
      soldByType = addModuleBreakdown(soldByType, modules);
    }

    if (windowDays.length > 0) {
      saleWindows.push({
        days: windowDays,
        endDate: window.endDate,
        startDate: window.startDate
      });
    }
  }

  const totalSpend = saleDays.reduce((sum, day) => sum + day.spend, 0);
  const totalOrders = saleDays.reduce((sum, day) => sum + day.orders, 0);
  const revenue = maxRevenueFromModuleMix(soldByType, moduleRevenue, fallbackRevenuePerModule);

  return {
    revenue,
    saleDays,
    saleWindows,
    soldByType,
    totalOrders,
    totalSpend
  };
}

function incomingForMonth(containers: IncomingContainer[], month: string) {
  return containers.reduce<ModuleBreakdown>((sum, container) => {
    if (!container.eta || !container.eta.startsWith(`${month}-`)) return sum;
    return addModuleBreakdown(sum, container.breakdown);
  }, emptyModules());
}

function projectSelectedMonth({
  currentSettings,
  plan,
  settingsByMonth
}: {
  currentSettings: DemandMonthSettings;
  plan: DemandCalendarPlan;
  settingsByMonth: Record<string, Partial<DemandMonthSettings>>;
}) {
  let startingInventoryByType = plan.defaultSale.baseVancouverOnHandByType;
  let selectedStartingInventoryByType = startingInventoryByType;
  let selectedIncomingByType = emptyModules();
  let selectedSimulation: ReturnType<typeof simulateAutoSales> | null = null;
  let selectedMonthInventoryByType = emptyModules();

  for (const month of monthKeysBetween(plan.defaultSale.firstPlanningMonth, plan.selectedMonth.month)) {
    const endDay = monthEndDay(month);
    const incomingByType = incomingForMonth(plan.defaultSale.incomingContainers, month);
    const monthInventoryByType = addModuleBreakdown(startingInventoryByType, incomingByType);
    const monthSettings = settingsForMonth({
      defaultDailyAdBudget: plan.defaultSale.defaultDailyAdBudget,
      endDay,
      month,
      override: month === plan.selectedMonth.month ? currentSettings : undefined,
      settingsByMonth
    });
    const windows = autoSaleWindows(
      month,
      endDay,
      monthSettings.saleStartDay,
      monthSettings.saleDurationDays,
      monthSettings.maxDaysApart
    );
    const simulation = simulateAutoSales({
      averageModulesPerOrder: plan.defaultSale.averageModulesPerOrder,
      customerAcquisitionCost: plan.defaultSale.customerAcquisitionCost,
      demandMix: monthInventoryByType,
      fallbackRevenuePerModule: plan.defaultSale.averageRevenuePerModule,
      maxDailyAdSpend: monthSettings.maxDailyAdSpend,
      moduleRevenue: plan.defaultSale.moduleRevenue,
      windows
    });

    if (month === plan.selectedMonth.month) {
      selectedStartingInventoryByType = startingInventoryByType;
      selectedIncomingByType = incomingByType;
      selectedMonthInventoryByType = monthInventoryByType;
      selectedSimulation = simulation;
    }

    startingInventoryByType = subtractModuleBreakdown(monthInventoryByType, simulation.soldByType);
  }

  const simulation = selectedSimulation || simulateAutoSales({
    averageModulesPerOrder: plan.defaultSale.averageModulesPerOrder,
    customerAcquisitionCost: plan.defaultSale.customerAcquisitionCost,
    demandMix: selectedMonthInventoryByType,
    fallbackRevenuePerModule: plan.defaultSale.averageRevenuePerModule,
    maxDailyAdSpend: currentSettings.maxDailyAdSpend,
    moduleRevenue: plan.defaultSale.moduleRevenue,
    windows: []
  });

  return {
    endingInventoryByType: subtractModuleBreakdown(selectedMonthInventoryByType, simulation.soldByType),
    incomingByType: selectedIncomingByType,
    monthInventoryByType: selectedMonthInventoryByType,
    simulation,
    startingInventoryByType: selectedStartingInventoryByType
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
  const defaultSettings = defaultMonthSettings(plan.defaultSale.defaultDailyAdBudget);
  const [maxDailyAdSpend, setMaxDailyAdSpend] = useState(defaultSettings.maxDailyAdSpend);
  const [maxDaysApart, setMaxDaysApart] = useState(defaultSettings.maxDaysApart);
  const [saleDurationDays, setSaleDurationDays] = useState(defaultSettings.saleDurationDays);
  const [saleStartDay, setSaleStartDay] = useState(defaultSettings.saleStartDay);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsByMonth, setSettingsByMonth] = useState<Record<string, Partial<DemandMonthSettings>>>({});

  useEffect(() => {
    setSettingsLoaded(false);
    const nextSettingsByMonth = readMonthSettings();
    const savedSettings = nextSettingsByMonth[plan.selectedMonth.month];
    const nextSettings = clampMonthSettings({
      ...defaultMonthSettings(plan.defaultSale.defaultDailyAdBudget),
      ...savedSettings
    }, plan.selectedMonth.endDay);

    setSettingsByMonth(nextSettingsByMonth);
    setMaxDailyAdSpend(nextSettings.maxDailyAdSpend);
    setMaxDaysApart(nextSettings.maxDaysApart);
    setSaleDurationDays(nextSettings.saleDurationDays);
    setSaleStartDay(nextSettings.saleStartDay);
    setSettingsLoaded(true);
  }, [plan.defaultSale.defaultDailyAdBudget, plan.selectedMonth.endDay, plan.selectedMonth.month]);

  useEffect(() => {
    if (!settingsLoaded || typeof window === "undefined") return;

    const nextSettingsByMonth = readMonthSettings();
    nextSettingsByMonth[plan.selectedMonth.month] = clampMonthSettings({
      maxDailyAdSpend,
      maxDaysApart,
      saleDurationDays,
      saleStartDay
    }, plan.selectedMonth.endDay);
    window.localStorage.setItem(monthSettingsStorageKey, JSON.stringify(nextSettingsByMonth));
    setSettingsByMonth(nextSettingsByMonth);
  }, [
    maxDailyAdSpend,
    maxDaysApart,
    plan.selectedMonth.endDay,
    plan.selectedMonth.month,
    saleDurationDays,
    saleStartDay,
    settingsLoaded
  ]);

  const currentSettings = clampMonthSettings({
    maxDailyAdSpend,
    maxDaysApart,
    saleDurationDays,
    saleStartDay
  }, plan.selectedMonth.endDay);
  const projection = projectSelectedMonth({
    currentSettings,
    plan,
    settingsByMonth
  });
  const { endingInventoryByType, incomingByType, simulation, startingInventoryByType } = projection;
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
            Starting inventory plus containers arriving this month, minus auto-placed sale windows.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-line bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Inventory equation</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <Stat label="Starting inventory" value={wholeNumber(totalBreakdown(startingInventoryByType))} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">+</div>
          <Stat label="Incoming containers" value={wholeNumber(totalBreakdown(incomingByType))} />
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
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Max gap between sales</span>
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
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sale length</span>
              <span className="text-lg font-semibold text-slate-950">{saleDurationDays} days</span>
            </div>
            <input
              className="mt-3 w-full accent-blue-600"
              max={21}
              min={1}
              onChange={(event) => setSaleDurationDays(Number(event.target.value))}
              step={1}
              type="range"
              value={saleDurationDays}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Starting mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(startingInventoryByType)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Incoming mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(incomingByType)}</p>
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
        <Stat label="Sale windows" value={wholeNumber(simulation.saleWindows.length)} />
        <Stat label="Sale days" value={wholeNumber(simulation.saleDays.length)} />
        <Stat label="Expected orders" value={wholeNumber(simulation.totalOrders)} />
        <Stat label="Revenue" tone="strong" value={simulation.revenue === null ? "Unavailable" : money(simulation.revenue)} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Stat label="Ad budget" value={money(simulation.totalSpend)} />
        <Stat
          label="Sale starts"
          value={displayDate(dayKey(plan.selectedMonth.month, saleStartDay))}
        />
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
          Click a calendar day to set the first sale start date. Sales repeat from there using the sale length and max gap.
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {simulation.saleWindows.map((window, index) => (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm" key={`${window.startDate}-${window.endDate}`}>
            <div className="font-semibold text-blue-800">Sale {index + 1}</div>
            <div className="mt-1 text-slate-700">
              {displayDate(window.startDate)} to {displayDate(window.endDate)}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">
              {wholeNumber(window.days.reduce((sum, day) => sum + totalBreakdown(day.modules), 0))} modules / {money(window.days.reduce((sum, day) => sum + day.spend, 0))} ads
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const saleDay = saleDaysByDate.get(cell.key);
          const isSaleStart = cell.day === saleStartDay;

          return cell.day ? (
            <button
              className={[
                "min-h-24 rounded-xl border p-2 text-left text-sm transition",
                "border-line bg-slate-50 hover:border-blue-300 hover:bg-blue-50",
                saleDay ? "border-blue-200 bg-blue-50 shadow-sm" : "",
                isSaleStart ? "ring-2 ring-blue-500 ring-offset-1" : ""
              ].join(" ")}
              key={cell.key}
              onClick={() => setSaleStartDay(cell.day || 1)}
              type="button"
            >
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{cell.day}</span>
                    {isSaleStart ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-white">
                        Start
                      </span>
                    ) : null}
                  </div>
                  {saleDay ? (
                    <div className="mt-3 rounded-lg bg-white p-2 text-xs leading-5">
                      <div className="font-semibold text-blue-700">Sale {saleDay.windowIndex + 1}</div>
                      <div className="text-slate-500">{money(saleDay.spend)} ads</div>
                      <div className="text-slate-500">{wholeNumber(saleDay.orders)} orders</div>
                      <div className="font-semibold text-slate-700">{wholeNumber(totalBreakdown(saleDay.modules))} modules</div>
                    </div>
                  ) : null}
                </>
            </button>
          ) : (
            <div className="min-h-24 rounded-xl border border-transparent p-2" key={cell.key} />
          );
        })}
      </div>
    </section>
  );
}
