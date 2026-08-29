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

export type DemandCalendarPlan = {
  defaultSale: {
    averageDailyModules: number;
    averageModulesPerOrder: number | null;
    averageOrderValue: number | null;
    cashBalance: number;
    customerAcquisitionCost: number | null;
    modules: number;
    openPayables: number;
    orders: number | null;
    recommendedStartDate: string | null;
    totalBudget: number | null;
  };
  monthLabel: string;
  saleEvents: DemandCalendarEvent[];
  selectedMonth: {
    endDay: number;
    firstDay: number;
    month: string;
  };
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function dayKey(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function getDayStatus(date: string, events: DemandCalendarEvent[]) {
  const event = events.find((item) => item.days.some((day) => day.date === date));
  const day = event?.days.find((item) => item.date === date) || null;

  return event && day ? { day, event } : null;
}

function dateFromKey(date: string) {
  return new Date(`${date}T00:00:00`);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function recalculateEvent(event: DemandCalendarEvent): DemandCalendarEvent {
  const days = [...event.days].sort((left, right) => left.date.localeCompare(right.date));

  return {
    ...event,
    dailyBudget: event.totalBudget === null || days.length === 0 ? null : event.totalBudget / days.length,
    date: days[0]?.date || event.date,
    days,
    endDate: days.at(-1)?.date || event.endDate
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function buildLocalEvent(days: { date: string; id: string }[], plan: DemandCalendarPlan): DemandCalendarEvent {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));

  return recalculateEvent({
    dailyBudget: null,
    date: sortedDays[0]?.date || plan.selectedMonth.month,
    days: sortedDays,
    endDate: sortedDays.at(-1)?.date || plan.selectedMonth.month,
    labels: plan.defaultSale.modules > 0 ? ["Vancouver on hand / eligible containers"] : [],
    modules: plan.defaultSale.modules,
    orders: plan.defaultSale.orders,
    totalBudget: plan.defaultSale.totalBudget
  });
}

export function DemandSaleCalendar({
  canEdit,
  plan
}: {
  canEdit: boolean;
  plan: DemandCalendarPlan;
}) {
  const defaultCashReserve = Math.max(0, Math.min(50000, Math.round(plan.defaultSale.cashBalance * 0.2 / 500) * 500));
  const [saleEvents, setSaleEvents] = useState<DemandCalendarEvent[]>(() =>
    plan.saleEvents.map(recalculateEvent)
  );
  const [minimumCashReserve, setMinimumCashReserve] = useState(defaultCashReserve);
  const [cacOverride, setCacOverride] = useState(Math.round(plan.defaultSale.customerAcquisitionCost || 250));
  const [maxDailyAdSpend, setMaxDailyAdSpend] = useState(600);
  const [factoryLeadDays, setFactoryLeadDays] = useState(90);
  const [payoutDelayDays, setPayoutDelayDays] = useState(3);
  const [safetyStockDays, setSafetyStockDays] = useState(30);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addSale(date: string, durationDays: number) {
    if (!canEdit || pendingDate) return;
    setPendingDate(date);
    setError(null);

    const response = await fetch("/api/demand-sales", {
      body: JSON.stringify({ duration_days: durationDays, sale_date: date }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Unable to add sale.");
      setPendingDate(null);
      return;
    }

    const createdDays = ((await response.json()) as { id: string; sale_date: string }[])
      .map((day) => ({ date: day.sale_date, id: day.id }));

    setSaleEvents((events) => {
      const existingDays = events.flatMap((event) => event.days);
      const mergedDays = [...existingDays, ...createdDays]
        .filter((day, index, days) => days.findIndex((item) => item.date === day.date) === index)
        .sort((left, right) => left.date.localeCompare(right.date));

      return mergedDays.length > 0 ? [buildLocalEvent(mergedDays, plan)] : [];
    });
    setPendingDate(null);
  }

  async function deleteSaleDay(day: { date: string; id: string }) {
    if (!canEdit || pendingDate) return;
    setPendingDate(day.date);
    setError(null);

    const response = await fetch(`/api/demand-sales/${day.id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Unable to delete sale.");
      setPendingDate(null);
      return;
    }

    setSaleEvents((events) => {
      const remainingDays = events.flatMap((event) => event.days).filter((item) => item.id !== day.id);
      return remainingDays.length > 0 ? [buildLocalEvent(remainingDays, plan)] : [];
    });
    setPendingDate(null);
  }

  const hasSales = saleEvents.length > 0;
  const activeSale = saleEvents[0] || null;
  const activeSaleDays = activeSale?.days.length || 0;
  const ordersToSell = plan.defaultSale.averageModulesPerOrder && plan.defaultSale.modules > 0
    ? Math.ceil(plan.defaultSale.modules / plan.defaultSale.averageModulesPerOrder)
    : plan.defaultSale.orders;
  const cashAvailableForAds = Math.max(0, plan.defaultSale.cashBalance - plan.defaultSale.openPayables - minimumCashReserve);
  const requiredAdSpend = ordersToSell !== null && ordersToSell !== undefined ? ordersToSell * cacOverride : null;
  const selectedDayAdCapacity = activeSaleDays > 0 ? maxDailyAdSpend * activeSaleDays : Number.POSITIVE_INFINITY;
  const totalAdSpend = requiredAdSpend === null ? null : Math.min(requiredAdSpend, cashAvailableForAds, selectedDayAdCapacity);
  const projectedOrders = totalAdSpend !== null ? Math.min(ordersToSell || 0, Math.floor(totalAdSpend / cacOverride)) : null;
  const dailyBudget = totalAdSpend !== null && activeSaleDays > 0 ? totalAdSpend / activeSaleDays : null;
  const maxRevenue = projectedOrders !== null && plan.defaultSale.averageOrderValue
    ? projectedOrders * plan.defaultSale.averageOrderValue
    : null;
  const plannedSoldModules = projectedOrders !== null && plan.defaultSale.averageModulesPerOrder
    ? Math.min(plan.defaultSale.modules, Math.ceil(projectedOrders * plan.defaultSale.averageModulesPerOrder))
    : 0;
  const automaticAdSpend = requiredAdSpend === null ? null : Math.min(requiredAdSpend, cashAvailableForAds);
  const autoSaleDays = automaticAdSpend && maxDailyAdSpend > 0 ? Math.max(1, Math.ceil(automaticAdSpend / maxDailyAdSpend)) : 0;
  const autoStartDate = plan.defaultSale.recommendedStartDate ? dateFromKey(plan.defaultSale.recommendedStartDate) : null;
  const autoEndDate = autoStartDate && autoSaleDays > 0 ? addDays(autoStartDate, autoSaleDays - 1) : null;
  const cashLowDate = autoEndDate ? addDays(autoEndDate, payoutDelayDays) : null;
  const lowestCash = plan.defaultSale.cashBalance - plan.defaultSale.openPayables - (totalAdSpend || 0);
  const projectedCashAfterRevenue = lowestCash + (maxRevenue || 0);
  const blockedByCash = requiredAdSpend !== null && automaticAdSpend !== null && automaticAdSpend < requiredAdSpend;
  const blockedByDailyCap = requiredAdSpend !== null && totalAdSpend !== null && activeSaleDays > 0 && totalAdSpend < Math.min(requiredAdSpend, cashAvailableForAds);
  const projectedRemainingModules = Math.max(0, plan.defaultSale.modules - plannedSoldModules);
  const safetyStockModules = Math.ceil(plan.defaultSale.averageDailyModules * safetyStockDays);
  const modulesToOrder = Math.max(0, safetyStockModules - projectedRemainingModules);
  const cashAfterPlan = plan.defaultSale.cashBalance - plan.defaultSale.openPayables - minimumCashReserve - (totalAdSpend || 0);
  const saleEndDate = activeSale?.endDate ? dateFromKey(activeSale.endDate) : null;
  const poDate = saleEndDate ? addDays(saleEndDate, -factoryLeadDays) : null;
  const today = new Date();
  const poTiming = !activeSale
    ? "Select sale days first"
    : modulesToOrder === 0
      ? "No PO needed from this plan"
      : poDate && poDate <= today
        ? "Place PO now"
        : poDate
          ? `Place PO by ${formatDate(poDate)}`
          : "Unavailable";
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
          <h2 className="text-lg font-semibold text-slate-950">Sale calendar</h2>
          <p className="text-xs font-medium text-slate-500">
            First click adds 10 sale days. After that, add or remove individual sale days.
          </p>
        </div>
        {pendingDate ? <span className="text-xs font-semibold text-blue-700">Saving...</span> : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950">Planning controls</h3>
              <p className="text-xs text-slate-500">Adjust the inputs you control. Live data stays underneath.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SliderControl
              label="Minimum cash reserve"
              max={Math.max(50000, Math.ceil(plan.defaultSale.cashBalance / 10000) * 10000)}
              min={0}
              onChange={setMinimumCashReserve}
              prefix="$"
              step={500}
              value={minimumCashReserve}
            />
            <SliderControl
              label="Max daily ad spend"
              max={2000}
              min={50}
              onChange={setMaxDailyAdSpend}
              prefix="$"
              step={25}
              value={maxDailyAdSpend}
            />
            <SliderControl
              label="CAC"
              max={800}
              min={50}
              onChange={setCacOverride}
              prefix="$"
              step={5}
              value={cacOverride}
            />
            <SliderControl
              label="Factory lead time"
              max={180}
              min={30}
              onChange={setFactoryLeadDays}
              step={5}
              suffix=" days"
              value={factoryLeadDays}
            />
            <SliderControl
              label="Shopify payout delay"
              max={14}
              min={0}
              onChange={setPayoutDelayDays}
              step={1}
              suffix=" days"
              value={payoutDelayDays}
            />
            <SliderControl
              label="Safety stock target"
              max={120}
              min={0}
              onChange={setSafetyStockDays}
              step={5}
              suffix=" days"
              value={safetyStockDays}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Purchase order timing</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{poTiming}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Modules to order" value={modulesToOrder} />
            <MiniMetric label="Safety stock target" value={`${safetyStockModules} modules`} />
            <MiniMetric label="Cash after plan" value={money(cashAfterPlan)} />
            <MiniMetric label="Max revenue" value={maxRevenue === null ? "Unavailable" : money(maxRevenue)} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Auto sale projection</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {autoStartDate && autoEndDate
                ? `${formatDate(autoStartDate)} to ${formatDate(autoEndDate)}`
                : "No automatic sale window available"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {blockedByCash
                ? "Cash reserve is limiting the plan before all orders can be acquired."
                : blockedByDailyCap
                  ? "Add more sale days or raise max daily ad spend to reach the full revenue target."
                : "Plan targets maximum revenue with the current cash and ad spend controls."}
            </p>
          </div>
          {autoStartDate && autoSaleDays > 0 && canEdit ? (
            <button
              className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              disabled={Boolean(pendingDate)}
              onClick={() => {
                void addSale(dateKey(autoStartDate), autoSaleDays);
              }}
              type="button"
            >
              Apply auto dates
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MiniMetric label="Auto sale days" value={autoSaleDays || "Unavailable"} />
          <MiniMetric label="Projected orders" value={projectedOrders ?? "Unavailable"} />
          <MiniMetric label="Lowest cash point" value={money(lowestCash)} />
          <MiniMetric label="Cash recovers around" value={cashLowDate ? formatDate(cashLowDate) : "Unavailable"} />
        </div>
        <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className={["h-3 rounded-full", lowestCash < minimumCashReserve ? "bg-red-500" : "bg-blue-600"].join(" ")}
            style={{
              width: `${Math.max(3, Math.min(100, plan.defaultSale.cashBalance > 0 ? (lowestCash / plan.defaultSale.cashBalance) * 100 : 0))}%`
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Cash after ad spend: {money(lowestCash)}</span>
          <span>After projected revenue: {money(projectedCashAfterRevenue)}</span>
        </div>
      </div>

      <CashSwingChart
        cashBalance={plan.defaultSale.cashBalance}
        dailyBudget={dailyBudget}
        maxRevenue={maxRevenue}
        minimumCashReserve={minimumCashReserve}
        openPayables={plan.defaultSale.openPayables}
        payoutDelayDays={payoutDelayDays}
        projectedCashAfterRevenue={projectedCashAfterRevenue}
        saleDays={activeSale?.days.map((day) => day.date) || []}
        totalAdSpend={totalAdSpend}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sale days selected</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{activeSaleDays}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Orders to sell</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{projectedOrders ?? "Unavailable"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Total ad spend</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {totalAdSpend === null ? "Unavailable" : money(totalAdSpend)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Budget per sale day</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {dailyBudget === null ? "Select sale days" : `${money(dailyBudget)} / day`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const status = cell.day ? getDayStatus(cell.key, saleEvents) : null;
          const event = status?.event || null;
          const saleDay = status?.day || null;
          const isStart = event?.date === cell.key;

          return (
            <div
              className={[
                "min-h-28 rounded-xl border p-2 text-left text-sm transition",
                cell.day ? "border-line bg-slate-50 hover:border-blue-200 hover:bg-blue-50" : "border-transparent",
                event ? "border-blue-200 bg-blue-50 shadow-sm" : "",
                !canEdit || !cell.day || event ? "cursor-default" : ""
              ].join(" ")}
              key={cell.key}
            >
              {cell.day ? (
                <>
                  <div className="font-semibold text-slate-700">{cell.day}</div>
                  {event ? (
                    <div className="mt-2 rounded-lg bg-white p-2 text-xs leading-5">
                      <div className="font-semibold text-blue-700">{isStart ? "Sale starts" : "Sale"}</div>
                      <div className="font-medium text-slate-950">{event.modules} modules</div>
                      <div className="text-slate-500">{projectedOrders ?? "Unavailable"} orders</div>
                      <div className="font-semibold text-slate-950">
                        {dailyBudget === null ? "Budget unavailable" : `${money(dailyBudget)} / day`}
                      </div>
                      {saleDay && canEdit ? (
                        <button
                          className="mt-2 inline-flex rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                          disabled={Boolean(pendingDate)}
                          onClick={() => {
                            void deleteSaleDay(saleDay);
                          }}
                          type="button"
                        >
                          Remove day
                        </button>
                      ) : null}
                    </div>
                  ) : canEdit ? (
                    <button
                      className="mt-8 w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-center text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                      disabled={Boolean(pendingDate)}
                      onClick={() => {
                        void addSale(cell.key, hasSales ? 1 : Math.min(10, plan.selectedMonth.endDay - dateFromKey(cell.key).getDate() + 1));
                      }}
                      type="button"
                    >
                      {hasSales ? "Add day" : "Add 10-day sale"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {saleEvents.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-slate-50 p-4 text-sm text-slate-500">
          No sale has been planned for {plan.monthLabel}. Click a calendar day to add one.
        </p>
      ) : null}
    </section>
  );
}

function SliderControl({
  label,
  max,
  min,
  onChange,
  prefix = "",
  step,
  suffix = "",
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  prefix?: string;
  step: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <span>{label}</span>
        <span className="text-slate-950">{prefix}{value.toLocaleString("en-US")}{suffix}</span>
      </span>
      <input
        className="mt-3 w-full accent-blue-600"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/80 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CashSwingChart({
  cashBalance,
  dailyBudget,
  maxRevenue,
  minimumCashReserve,
  openPayables,
  payoutDelayDays,
  projectedCashAfterRevenue,
  saleDays,
  totalAdSpend
}: {
  cashBalance: number;
  dailyBudget: number | null;
  maxRevenue: number | null;
  minimumCashReserve: number;
  openPayables: number;
  payoutDelayDays: number;
  projectedCashAfterRevenue: number;
  saleDays: string[];
  totalAdSpend: number | null;
}) {
  const sortedSaleDays = [...saleDays].sort();
  const today = new Date();
  let runningCash = cashBalance;
  const points: { amount: number; date: Date; label: string; type: "start" | "out" | "low" | "in" }[] = [
    { amount: runningCash, date: today, label: "Starting cash", type: "start" }
  ];

  if (openPayables > 0) {
    runningCash -= openPayables;
    points.push({ amount: runningCash, date: today, label: "After payables", type: "out" });
  }

  const spendPerDay = dailyBudget || 0;
  sortedSaleDays.forEach((saleDate, index) => {
    runningCash -= spendPerDay;
    points.push({
      amount: runningCash,
      date: dateFromKey(saleDate),
      label: `Sale day ${index + 1}`,
      type: index === sortedSaleDays.length - 1 ? "low" : "out"
    });
  });

  const lastSaleDate = sortedSaleDays.at(-1);

  if (lastSaleDate && maxRevenue) {
    points.push({
      amount: projectedCashAfterRevenue,
      date: addDays(dateFromKey(lastSaleDate), payoutDelayDays),
      label: "Projected cash back",
      type: "in"
    });
  }

  const values = [...points.map((point) => point.amount), minimumCashReserve];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const chartWidth = 720;
  const chartHeight = 260;
  const paddingX = 44;
  const paddingY = 34;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: paddingX + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth),
    y: paddingY + ((maxValue - point.amount) / range) * plotHeight
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const reserveY = paddingY + ((maxValue - minimumCashReserve) / range) * plotHeight;
  const lowestPoint = coordinates.reduce((lowest, point) => (point.amount < lowest.amount ? point : lowest), coordinates[0]);
  const selectedSaleDays = sortedSaleDays.length;

  return (
    <section className="mt-4 rounded-2xl border border-line bg-slate-950 p-4 text-white shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-blue-300">Cash swing</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {lowestPoint ? `Low point ${money(lowestPoint.amount)}` : "Select sale days to see the dip"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Shows payables, ad spend drawdown, and projected Shopify cash recovery.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4 lg:min-w-[520px]">
          <DarkMetric label="Sale days" value={selectedSaleDays || "None"} />
          <DarkMetric label="Daily spend" value={dailyBudget === null ? "Select days" : money(dailyBudget)} />
          <DarkMetric label="Total spend" value={totalAdSpend === null ? "Unavailable" : money(totalAdSpend)} />
          <DarkMetric label="Reserve" value={money(minimumCashReserve)} />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg className="min-w-[720px]" height={chartHeight} role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%">
          <defs>
            <linearGradient id="cashLineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="55%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="cashFillGradient" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect fill="#020617" height={chartHeight} rx="18" width={chartWidth} />
          <line stroke="#334155" strokeDasharray="6 6" strokeWidth="1" x1={paddingX} x2={chartWidth - paddingX} y1={reserveY} y2={reserveY} />
          <text fill="#93c5fd" fontSize="11" fontWeight="700" x={paddingX} y={Math.max(14, reserveY - 8)}>
            Cash reserve {money(minimumCashReserve)}
          </text>
          {coordinates.length > 1 ? (
            <>
              <path d={`${path} L ${coordinates.at(-1)?.x || paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`} fill="url(#cashFillGradient)" />
              <path d={path} fill="none" stroke="url(#cashLineGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            </>
          ) : null}
          {coordinates.map((point) => (
            <g key={`${point.label}-${point.x}`}>
              <circle
                cx={point.x}
                cy={point.y}
                fill={point.type === "in" ? "#22c55e" : point.type === "low" || point.amount < minimumCashReserve ? "#ef4444" : "#60a5fa"}
                r="6"
              />
              <text fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle" x={point.x} y={point.y - 13}>
                {money(point.amount)}
              </text>
              <text fill="#94a3b8" fontSize="10" textAnchor="middle" x={point.x} y={chartHeight - 16}>
                {point.label}
              </text>
              <text fill="#cbd5e1" fontSize="10" textAnchor="middle" x={point.x} y={chartHeight - 4}>
                {shortDate(point.date)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function DarkMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
      <p className="font-medium text-slate-300">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
