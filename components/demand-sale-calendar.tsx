"use client";

import { useRouter } from "next/navigation";
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

export type DemandCalendarPlan = {
  defaultSale: {
    averageModulesPerOrder: number | null;
    eligibleInboundByType: ModuleBreakdown;
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

function buildLocalEvent(days: { date: string; id: string }[], plan: DemandCalendarPlan): DemandCalendarEvent {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));

  return recalculateEvent({
    dailyBudget: null,
    date: sortedDays[0]?.date || plan.selectedMonth.month,
    days: sortedDays,
    endDate: sortedDays.at(-1)?.date || plan.selectedMonth.month,
    labels: [],
    modules: plan.defaultSale.modules,
    orders: plan.defaultSale.orders,
    totalBudget: plan.defaultSale.totalBudget
  });
}

function getSaleDay(date: string, events: DemandCalendarEvent[]) {
  return events.flatMap((event) => event.days).find((day) => day.date === date) || null;
}

function totalBreakdown(breakdown: ModuleBreakdown) {
  return breakdown.corner + breakdown.armless + breakdown.ottoman;
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

export function DemandSaleCalendar({
  canEdit,
  plan
}: {
  canEdit: boolean;
  plan: DemandCalendarPlan;
}) {
  const router = useRouter();
  const [saleEvents, setSaleEvents] = useState<DemandCalendarEvent[]>(() =>
    plan.saleEvents.map(recalculateEvent)
  );
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaleEvents(plan.saleEvents.map(recalculateEvent));
  }, [plan]);

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
    router.refresh();
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
    router.refresh();
    setPendingDate(null);
  }

  const activeSale = saleEvents[0] || null;
  const activeSaleDays = activeSale?.days.length || 0;
  const dailyBudget = plan.defaultSale.totalBudget !== null && activeSaleDays > 0
    ? plan.defaultSale.totalBudget / activeSaleDays
    : null;
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
            Starting inventory plus containers arriving this month, minus inventory planned to sell.
          </p>
        </div>
        {pendingDate ? <span className="text-xs font-semibold text-blue-700">Saving...</span> : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="mt-5 rounded-3xl border border-line bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Inventory equation</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <Stat label="Starting inventory" value={wholeNumber(plan.defaultSale.vancouverOnHand)} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">+</div>
          <Stat label="Incoming containers" value={wholeNumber(plan.defaultSale.totalActiveInboundModules)} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">-</div>
          <Stat label="Planned to sell" value={wholeNumber(totalBreakdown(plan.defaultSale.plannedSoldBeforeMonthByType))} />
          <div className="hidden items-center text-2xl font-semibold text-slate-400 lg:flex">=</div>
          <Stat label="Sellable inventory" tone="strong" value={wholeNumber(plan.defaultSale.modules)} />
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
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Planned to sell</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(plan.defaultSale.plannedSoldBeforeMonthByType)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sellable mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{moduleBreakdownText(plan.defaultSale.modulesByType)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders" value={plan.defaultSale.orders === null ? "Unavailable" : wholeNumber(plan.defaultSale.orders)} />
        <Stat label="Revenue" tone="strong" value={plan.defaultSale.maxRevenue === null ? "Unavailable" : money(plan.defaultSale.maxRevenue)} />
        <Stat label="Ad budget" value={plan.defaultSale.totalBudget === null ? "Unavailable" : money(plan.defaultSale.totalBudget)} />
        <Stat label="Source month" value={plan.defaultSale.shopifyProjectionMonth} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-950">
          Average modules/order: {plan.defaultSale.averageModulesPerOrder === null ? "Unavailable" : plan.defaultSale.averageModulesPerOrder.toFixed(1)}
        </span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Module revenue: {revenueBreakdownText(plan.defaultSale.moduleRevenue)}</span>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Sale days</h3>
          <p className="text-xs font-medium text-slate-500">
            First click adds 10 sale days. After that, add or remove individual sale days.
          </p>
        </div>
        {dailyBudget !== null ? (
          <p className="text-sm font-semibold text-slate-700">{money(dailyBudget)} ads/day across {activeSaleDays} sale days</p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const saleDay = cell.day ? getSaleDay(cell.key, saleEvents) : null;
          const isSaleDay = Boolean(saleDay);

          return (
            <div
              className={[
                "min-h-24 rounded-xl border p-2 text-left text-sm transition",
                cell.day ? "border-line bg-slate-50" : "border-transparent",
                isSaleDay ? "border-blue-200 bg-blue-50 shadow-sm" : "",
                canEdit && cell.day && !isSaleDay ? "hover:border-blue-200 hover:bg-blue-50" : ""
              ].join(" ")}
              key={cell.key}
            >
              {cell.day ? (
                <>
                  <div className="font-semibold text-slate-700">{cell.day}</div>
                  {isSaleDay ? (
                    <div className="mt-3 rounded-lg bg-white p-2 text-xs leading-5">
                      <div className="font-semibold text-blue-700">Sale day</div>
                      <div className="text-slate-500">
                        {dailyBudget === null ? "Ad budget unavailable" : `${money(dailyBudget)} ads`}
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
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ) : canEdit ? (
                    <button
                      className="mt-6 w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-center text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                      disabled={Boolean(pendingDate)}
                      onClick={() => {
                        void addSale(cell.key, activeSale ? 1 : Math.min(10, plan.selectedMonth.endDay - dateFromKey(cell.key).getDate() + 1));
                      }}
                      type="button"
                    >
                      {activeSale ? "Add day" : "Add 10-day sale"}
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
