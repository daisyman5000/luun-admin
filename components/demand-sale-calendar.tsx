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
    modules: number;
    orders: number | null;
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
  const [saleEvents, setSaleEvents] = useState<DemandCalendarEvent[]>(() =>
    plan.saleEvents.map(recalculateEvent)
  );
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
  const dailyBudget = activeSale?.dailyBudget ?? null;
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

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sale days selected</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{activeSaleDays}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Orders to sell</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{activeSale?.orders ?? "Unavailable"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Total ad spend</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {activeSale?.totalBudget === null || activeSale?.totalBudget === undefined ? "Unavailable" : money(activeSale.totalBudget)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Budget per sale day</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {dailyBudget === null ? "Unavailable" : `${money(dailyBudget)} / day`}
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
                      <div className="text-slate-500">{event.orders ?? "Unavailable"} orders</div>
                      <div className="font-semibold text-slate-950">
                        {event.dailyBudget === null ? "Budget unavailable" : `${money(event.dailyBudget)} / day`}
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
