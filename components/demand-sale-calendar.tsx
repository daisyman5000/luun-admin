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

export type DemandCashObligation = {
  amount: number;
  amountCad: number | null;
  currency: string;
  dueDate: string | null;
  id: string;
  label: string;
  type: "container" | "invoice" | "wayflyer";
};

export type DemandCalendarPlan = {
  defaultSale: {
    activeContainerCount: number;
    averageDailyModules: number;
    averageModulesPerOrder: number | null;
    averageOrderValue: number | null;
    cacMetaSpend: number;
    cacOrderCount: number;
    cashBalance: number;
    customerAcquisitionCost: number | null;
    modules: number;
    openPayables: number;
    orders: number | null;
    recommendedStartDate: string | null;
    shopifyOrderCount: number;
    shopifyRevenueOrderCount: number;
    totalActiveInboundModules: number;
    totalBudget: number | null;
    vancouverOnHand: number;
    wiseCashBalance: number;
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

type RecommendedContainerOrder = {
  arrivalDate: string;
  factoryReadyDate: string;
  orderDate: string;
  sequence: number;
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function obligationDate(obligation: Pick<DemandCashObligation, "dueDate">) {
  return obligation.dueDate || todayKey();
}

function addDaysToKey(date: string, days: number) {
  const nextDate = dateFromKey(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
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
  const router = useRouter();
  const [saleEvents, setSaleEvents] = useState<DemandCalendarEvent[]>(() =>
    plan.saleEvents.map(recalculateEvent)
  );
  const [salesCashLeadDays, setSalesCashLeadDays] = useState(7);
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

  const hasSales = saleEvents.length > 0;
  const activeSale = saleEvents[0] || null;
  const activeSaleDays = activeSale?.days.length || 0;
  const totalAdSpend = plan.defaultSale.totalBudget;
  const dailyBudget = totalAdSpend !== null && activeSaleDays > 0 ? totalAdSpend / activeSaleDays : null;
  const saleDayDates = (activeSale?.days || []).map((day) => day.date).sort();
  const averageOrderValue = plan.defaultSale.averageOrderValue;
  const customerAcquisitionCost = plan.defaultSale.customerAcquisitionCost;
  const projectedOrdersPerSaleDay = dailyBudget !== null && customerAcquisitionCost !== null && customerAcquisitionCost > 0
    ? dailyBudget / customerAcquisitionCost
    : null;
  const projectedRevenuePerSaleDay = projectedOrdersPerSaleDay !== null && averageOrderValue !== null
    ? projectedOrdersPerSaleDay * averageOrderValue
    : null;
  const projectedRevenue = projectedRevenuePerSaleDay === null
    ? null
    : projectedRevenuePerSaleDay * activeSaleDays;
  const possibleRevenue = plan.defaultSale.orders !== null && averageOrderValue !== null
    ? plan.defaultSale.orders * averageOrderValue
    : null;
  const projectedRevenueEvents = saleDayDates
    .map((saleDate, index) => ({
      amount: projectedRevenuePerSaleDay,
      date: addDaysToKey(saleDate, salesCashLeadDays),
      id: `${saleDate}-${index}`,
      orders: projectedOrdersPerSaleDay,
      saleDate
    }))
    .filter((event) => event.amount !== null);
  const hasUnconvertedObligations = plan.cashObligations.some((item) => item.amountCad === null);
  const containerPayables = plan.cashObligations
    .filter((item) => item.type === "container")
    .reduce((sum, item) => sum + (item.amountCad || 0), 0);
  const containerPayablesUnavailable = plan.cashObligations.some((item) => item.type === "container" && item.amountCad === null);
  const otherMajorInvoices = plan.cashObligations
    .filter((item) => item.type === "invoice")
    .reduce((sum, item) => sum + (item.amountCad || 0), 0);
  const otherMajorInvoicesUnavailable = plan.cashObligations.some((item) => item.type === "invoice" && item.amountCad === null);
  const wayflyerPaybacks = plan.cashObligations
    .filter((item) => item.type === "wayflyer")
    .reduce((sum, item) => sum + (item.amountCad || 0), 0);
  const wayflyerPaybacksUnavailable = plan.cashObligations.some((item) => item.type === "wayflyer" && item.amountCad === null);
  const totalObligations = containerPayables + otherMajorInvoices + wayflyerPaybacks;
  const cashBeforeAds = plan.defaultSale.cashBalance - totalObligations;
  const cashAfterPlan = totalAdSpend === null || projectedRevenue === null || hasUnconvertedObligations
    ? null
    : cashBeforeAds - totalAdSpend + projectedRevenue;
  const containerDepositPercent = 30;
  const containerProductionDays = 30;
  const containerShippingDays = 30;
  const containerTotalLeadDays = containerProductionDays + containerShippingDays;
  const totalInventoryPipeline = plan.defaultSale.vancouverOnHand + plan.defaultSale.totalActiveInboundModules;
  const projectedCoverageDays = plan.defaultSale.averageDailyModules > 0
    ? Math.floor(totalInventoryPipeline / plan.defaultSale.averageDailyModules)
    : null;
  const projectedSelloutDate = projectedCoverageDays === null
    ? null
    : addDaysToKey(new Date().toISOString().slice(0, 10), projectedCoverageDays);
  const averageInboundContainerModules = plan.defaultSale.totalActiveInboundModules > 0
    ? Math.round(plan.defaultSale.totalActiveInboundModules / Math.max(1, plan.defaultSale.activeContainerCount))
    : plan.defaultSale.modules;
  const reorderCoverageDays = plan.defaultSale.averageDailyModules > 0 && averageInboundContainerModules > 0
    ? Math.max(1, Math.floor(averageInboundContainerModules / plan.defaultSale.averageDailyModules))
    : null;
  const recommendedContainerOrders: RecommendedContainerOrder[] = [];

  if (projectedSelloutDate !== null && reorderCoverageDays !== null) {
    let nextSelloutDate = projectedSelloutDate;

    for (let sequence = 1; sequence <= 8; sequence += 1) {
      const orderDate = addDaysToKey(nextSelloutDate, -containerTotalLeadDays);

      recommendedContainerOrders.push({
        arrivalDate: addDaysToKey(orderDate, containerTotalLeadDays),
        factoryReadyDate: addDaysToKey(orderDate, containerProductionDays),
        orderDate,
        sequence
      });

      nextSelloutDate = addDaysToKey(nextSelloutDate, reorderCoverageDays);
    }
  }

  const firstRecommendedOrder = recommendedContainerOrders[0] || null;
  const recommendedPurchaseDate = firstRecommendedOrder?.orderDate || null;
  const recommendedFactoryReadyDate = firstRecommendedOrder?.factoryReadyDate || null;
  const recommendedArrivalDate = firstRecommendedOrder?.arrivalDate || null;
  const shouldBuyNow = recommendedPurchaseDate !== null && recommendedPurchaseDate <= new Date().toISOString().slice(0, 10);

  function obligationSpendThrough(date: string) {
    return plan.cashObligations.reduce((sum, item) => {
      if (obligationDate(item) <= date) return sum + (item.amountCad || 0);
      return sum;
    }, 0);
  }

  function adSpendThrough(date: string) {
    if (dailyBudget === null) return 0;
    return saleDayDates.filter((saleDate) => saleDate <= date).length * dailyBudget;
  }

  function revenueThrough(date: string) {
    return projectedRevenueEvents.reduce((sum, event) => {
      if (event.date <= date) return sum + (event.amount || 0);
      return sum;
    }, 0);
  }

  function cashAfterDate(date: string) {
    if (hasUnconvertedObligations) return null;
    return plan.defaultSale.cashBalance - obligationSpendThrough(date) - adSpendThrough(date) + revenueThrough(date);
  }

  function obligationsDueOn(date: string) {
    return plan.cashObligations.filter((item) => obligationDate(item) === date);
  }

  function revenueDueOn(date: string) {
    return projectedRevenueEvents.filter((event) => event.date === date);
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

      <div className="mt-4 rounded-3xl border border-line bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Demand plan</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {plan.defaultSale.orders ?? "Unavailable"} max orders this month
            </h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-400">Sellable modules</span>
                <span className="font-semibold text-slate-950">{plan.defaultSale.modules}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-400">Avg modules / order</span>
                <span className="font-semibold text-slate-950">
                  {plan.defaultSale.averageModulesPerOrder === null ? "Unavailable" : plan.defaultSale.averageModulesPerOrder.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-400">Avg order value</span>
                <span className="font-semibold text-slate-950">
                  {averageOrderValue === null ? "Unavailable" : money(averageOrderValue)}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-400">Max revenue</span>
                <span className="font-semibold text-slate-950">
                  {possibleRevenue === null ? "Unavailable" : money(possibleRevenue)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Source: {plan.defaultSale.shopifyRevenueOrderCount} paid Shopify orders with revenue
              from {plan.defaultSale.shopifyOrderCount} imported orders, Vancouver inventory, eligible container ETAs,
              and prior planned sale days.
            </p>
          </div>
          <label className="w-full max-w-xs text-sm font-semibold text-slate-700">
            Sales cash lead time
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2">
              <input
                className="w-20 bg-transparent text-lg font-semibold text-slate-950 outline-none"
                max={60}
                min={0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSalesCashLeadDays(Number.isFinite(value) ? Math.max(0, Math.min(60, value)) : 7);
                }}
                type="number"
                value={salesCashLeadDays}
              />
              <span className="text-sm text-slate-500">days from ad spend to sales cash</span>
            </div>
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">CAC</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {customerAcquisitionCost === null ? "Unavailable" : money(customerAcquisitionCost)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {money(plan.defaultSale.cacMetaSpend)} Meta spend / {plan.defaultSale.cacOrderCount} Shopify orders.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Ad budget</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totalAdSpend === null ? "Unavailable" : money(totalAdSpend)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {plan.defaultSale.orders === null || customerAcquisitionCost === null
                ? "Needs Shopify orders and Meta spend."
                : `${plan.defaultSale.orders} max orders x ${money(customerAcquisitionCost)} CAC.`}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Max revenue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {possibleRevenue === null ? "Unavailable" : money(possibleRevenue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {plan.defaultSale.orders === null || averageOrderValue === null
                ? "Needs imported Shopify order revenue."
                : `${plan.defaultSale.orders} max orders x ${money(averageOrderValue)} avg order value.`}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Cash after plan</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {cashAfterPlan === null ? "Unavailable" : money(cashAfterPlan)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Includes Wise cash, obligations, ads, and projected sales cash.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">Next container</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {recommendedPurchaseDate === null ? "Unavailable" : shouldBuyNow ? "Buy now" : recommendedPurchaseDate}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Pay {containerDepositPercent}% deposit on PO date. Production is {containerProductionDays} days, shipping is {containerShippingDays} days, and 70% is due when it arrives in Canada.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {projectedSelloutDate === null
                ? "Needs Shopify sales velocity."
                : `Projected sellout ${projectedSelloutDate}. Factory ready ${recommendedFactoryReadyDate}. Canada arrival ${recommendedArrivalDate}.`}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-600 lg:grid-cols-4">
          <div>Starting cash: <span className="font-semibold text-slate-950">{money(plan.defaultSale.cashBalance)}</span></div>
          <div>Wise cash today: <span className="font-semibold text-slate-950">{money(plan.defaultSale.wiseCashBalance)}</span></div>
          <div>Container payables: <span className="font-semibold text-slate-950">{containerPayablesUnavailable ? "FX unavailable" : money(containerPayables)}</span></div>
          <div>Invoices: <span className="font-semibold text-slate-950">{otherMajorInvoicesUnavailable ? "FX unavailable" : money(otherMajorInvoices)}</span></div>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Wayflyer: <span className="font-semibold text-slate-950">{wayflyerPaybacksUnavailable ? "FX unavailable" : money(wayflyerPaybacks)}</span>
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
          const dueObligations = cell.day ? obligationsDueOn(cell.key) : [];
          const dueRevenue = cell.day ? revenueDueOn(cell.key) : [];
          const revenueDue = dueRevenue.reduce((sum, item) => sum + (item.amount || 0), 0);
          const hasCashActivity = Boolean(event || dueObligations.length > 0 || dueRevenue.length > 0);
          const recommendedOrder = cell.day
            ? recommendedContainerOrders.find((order) => order.orderDate === cell.key)
            : null;
          const recommendedArrival = cell.day
            ? recommendedContainerOrders.find((order) => order.arrivalDate === cell.key)
            : null;
          const cashAfterThisDay = cell.day ? cashAfterDate(cell.key) : null;
          const obligationDue = dueObligations.reduce((sum, item) => sum + (item.amountCad || 0), 0);

          return (
            <div
              className={[
                "min-h-28 rounded-xl border p-2 text-left text-sm transition",
                cell.day ? "border-line bg-slate-50 hover:border-blue-200 hover:bg-blue-50" : "border-transparent",
                hasCashActivity || recommendedOrder || recommendedArrival ? "border-blue-200 bg-blue-50 shadow-sm" : "",
                !canEdit || !cell.day || event ? "cursor-default" : ""
              ].join(" ")}
              key={cell.key}
            >
              {cell.day ? (
                <>
                  <div className="font-semibold text-slate-700">{cell.day}</div>
                  {cashAfterThisDay !== null ? (
                    <div className="mt-2 rounded-lg bg-white p-2 text-xs leading-5">
                      <div className="text-slate-500">Cash after</div>
                      <div className="text-base font-semibold text-slate-950">{money(cashAfterThisDay)}</div>
                      {event ? (
                        <div className="mt-1 font-semibold text-blue-700">
                          {isStart ? "Sale starts" : "Sale"}: {dailyBudget === null ? "budget unavailable" : money(dailyBudget)}
                        </div>
                      ) : null}
                      {revenueDue > 0 ? (
                        <div className="mt-1 font-semibold text-emerald-700">Sales cash: +{money(revenueDue)}</div>
                      ) : null}
                      {dueObligations.length > 0 ? (
                        <div className="mt-1 font-semibold text-amber-700">Bills due: -{money(obligationDue)}</div>
                      ) : null}
                      {recommendedOrder ? (
                        <div className="mt-1 font-semibold text-violet-700">
                          Container PO #{recommendedOrder.sequence}: 30% deposit
                        </div>
                      ) : null}
                      {recommendedArrival ? (
                        <div className="mt-1 font-semibold text-violet-700">
                          Container #{recommendedArrival.sequence} arrives: 70% due
                        </div>
                      ) : null}
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
                  ) : null}
                  {!event && canEdit ? (
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
