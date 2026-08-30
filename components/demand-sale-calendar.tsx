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

export type DemandCashObligation = {
  amount: number;
  dueDate: string | null;
  id: string;
  label: string;
  type: "container" | "invoice" | "wayflyer";
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
  cashObligations: DemandCashObligation[];
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

function formatDateLabel(date: string | null) {
  if (!date) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short"
  }).format(dateFromKey(date));
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
  const [pendingExpense, setPendingExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [invoiceLabel, setInvoiceLabel] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [cashObligations, setCashObligations] = useState<DemandCashObligation[]>(plan.cashObligations);

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

  async function addMajorInvoice() {
    if (!canEdit || pendingExpense) return;
    setPendingExpense(true);
    setExpenseError(null);

    const response = await fetch("/api/major-expenses", {
      body: JSON.stringify({
        amount: invoiceAmount,
        due_date: invoiceDueDate || null,
        label: invoiceLabel,
        notes: invoiceNotes
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setExpenseError(body?.error || "Unable to add invoice.");
      setPendingExpense(false);
      return;
    }

    const created = (await response.json()) as {
      amount: number | null;
      due_date: string | null;
      id: string;
      label: string;
    };
    setCashObligations((items) => [
      ...items,
      {
        amount: Number(created.amount || 0),
        dueDate: created.due_date,
        id: created.id,
        label: created.label,
        type: "invoice"
      }
    ]);
    setInvoiceLabel("");
    setInvoiceAmount("");
    setInvoiceDueDate("");
    setInvoiceNotes("");
    setPendingExpense(false);
  }

  async function deleteMajorInvoice(id: string) {
    if (!canEdit || pendingExpense) return;
    setPendingExpense(true);
    setExpenseError(null);

    const response = await fetch(`/api/major-expenses/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setExpenseError(body?.error || "Unable to remove invoice.");
      setPendingExpense(false);
      return;
    }

    setCashObligations((items) => items.filter((item) => item.id !== id));
    setPendingExpense(false);
  }

  const hasSales = saleEvents.length > 0;
  const activeSale = saleEvents[0] || null;
  const activeSaleDays = activeSale?.days.length || 0;
  const totalAdSpend = plan.defaultSale.totalBudget;
  const dailyBudget = totalAdSpend !== null && activeSaleDays > 0 ? totalAdSpend / activeSaleDays : null;
  const saleDayDates = (activeSale?.days || []).map((day) => day.date).sort();
  const containerPayables = cashObligations
    .filter((item) => item.type === "container")
    .reduce((sum, item) => sum + item.amount, 0);
  const otherMajorInvoices = cashObligations
    .filter((item) => item.type === "invoice")
    .reduce((sum, item) => sum + item.amount, 0);
  const wayflyerPaybacks = cashObligations
    .filter((item) => item.type === "wayflyer")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalObligations = containerPayables + otherMajorInvoices + wayflyerPaybacks;
  const cashBeforeAds = plan.defaultSale.cashBalance - totalObligations;
  const cashAfterAllAdSpend = totalAdSpend === null ? null : cashBeforeAds - totalAdSpend;
  const sortedObligations = [...cashObligations].sort((left, right) => {
    if (!left.dueDate && !right.dueDate) return left.label.localeCompare(right.label);
    if (!left.dueDate) return 1;
    if (!right.dueDate) return -1;
    return left.dueDate.localeCompare(right.dueDate);
  });

  function obligationSpendThrough(date: string) {
    return cashObligations.reduce((sum, item) => {
      if (!item.dueDate || item.dueDate <= date) return sum + item.amount;
      return sum;
    }, 0);
  }
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Wise cash</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(plan.defaultSale.cashBalance)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Container remainder</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(containerPayables)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Other major invoices</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(otherMajorInvoices)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Wayflyer paybacks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{money(wayflyerPaybacks)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Sale days selected</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{activeSaleDays}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Orders to sell</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{plan.defaultSale.orders ?? "Unavailable"}</p>
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
        <div className="rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Cash after obligations + ads</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {cashAfterAllAdSpend === null ? "Unavailable" : money(cashAfterAllAdSpend)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-slate-50 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">Cash obligations</h3>
            <p className="text-xs text-slate-500">Container remainders are automatic. Add other major invoices here.</p>
          </div>
          {pendingExpense ? <span className="text-xs font-semibold text-blue-700">Saving...</span> : null}
        </div>

        {expenseError ? (
          <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{expenseError}</p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr_auto]">
          <input
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300"
            disabled={!canEdit || pendingExpense}
            onChange={(event) => setInvoiceLabel(event.target.value)}
            placeholder="Invoice name"
            type="text"
            value={invoiceLabel}
          />
          <input
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300"
            disabled={!canEdit || pendingExpense}
            min="0"
            onChange={(event) => setInvoiceAmount(event.target.value)}
            placeholder="Amount"
            type="number"
            value={invoiceAmount}
          />
          <input
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300"
            disabled={!canEdit || pendingExpense}
            onChange={(event) => setInvoiceDueDate(event.target.value)}
            type="date"
            value={invoiceDueDate}
          />
          <input
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300"
            disabled={!canEdit || pendingExpense}
            onChange={(event) => setInvoiceNotes(event.target.value)}
            placeholder="Notes"
            type="text"
            value={invoiceNotes}
          />
          <button
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            disabled={!canEdit || pendingExpense || !invoiceLabel.trim() || !invoiceAmount}
            onClick={() => {
              void addMajorInvoice();
            }}
            type="button"
          >
            Add
          </button>
        </div>

        <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {sortedObligations.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No cash obligations entered yet.</p>
          ) : (
            sortedObligations.map((item) => (
              <div className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_auto_auto]" key={`${item.type}-${item.id}`}>
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.type === "container"
                      ? "Container remainder"
                      : item.type === "wayflyer"
                        ? "Wayflyer payback"
                        : "Major invoice"}
                  </p>
                </div>
                <div className="font-semibold text-slate-950 md:text-right">{money(item.amount)}</div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className="text-slate-500">{formatDateLabel(item.dueDate)}</span>
                  {item.type === "invoice" && canEdit ? (
                    <button
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                      disabled={pendingExpense}
                      onClick={() => {
                        void deleteMajorInvoice(item.id);
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
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
          const saleDayIndex = saleDay ? saleDayDates.indexOf(saleDay.date) : -1;
          const cashAfterThisDay = dailyBudget !== null && saleDayIndex >= 0
            ? plan.defaultSale.cashBalance - obligationSpendThrough(saleDayDates[saleDayIndex]) - dailyBudget * (saleDayIndex + 1)
            : null;

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
                      <div className="text-slate-500">{plan.defaultSale.orders ?? "Unavailable"} orders</div>
                      <div className="font-semibold text-slate-950">
                        {dailyBudget === null ? "Budget unavailable" : `${money(dailyBudget)} / day`}
                      </div>
                      <div className="text-slate-500">
                        Cash after: {cashAfterThisDay === null ? "Unavailable" : money(cashAfterThisDay)}
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
