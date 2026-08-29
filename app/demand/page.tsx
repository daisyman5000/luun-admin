import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWiseSummary } from "@/lib/wise/client";
import type { ContainerEntry, InventoryRow, ShopifyOrder } from "@/lib/types";

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
  date: Date;
  label: string;
  modules: number;
  orders: number | null;
};

type CalendarCell = {
  date: Date | null;
  event: SaleEvent | null;
  key: string;
};

type DemandPlan = {
  averageModulesPerOrder: number | null;
  averageOrderValue: number | null;
  containersEligibleThisMonth: ContainerDemand[];
  currentMonth: string;
  customerAcquisitionCost: number | null;
  daysUntilNextDemandWindow: number | null;
  maxRevenue: number | null;
  nextDemandContainer: ContainerDemand | null;
  selectedMonth: MonthOption;
  saleEvents: SaleEvent[];
  targetMetaBudget: number | null;
  targetModulesToSell: number;
  targetOrdersToSell: number | null;
  vancouverOnHand: number;
};

const saleLeadDays = 20;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function laterDate(left: Date, right: Date) {
  return left > right ? left : right;
}

function daysBetween(start: Date, end: Date) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDay.getTime() - startDay.getTime()) / 86_400_000);
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

function buildSaleEvents({
  averageModulesPerOrder,
  containers,
  selectedMonth,
  vancouverOnHandSaleDate,
  vancouverOnHand
}: {
  averageModulesPerOrder: number | null;
  containers: ContainerDemand[];
  selectedMonth: MonthOption;
  vancouverOnHandSaleDate: Date | null;
  vancouverOnHand: number;
}) {
  let nextAvailableSaleDate = selectedMonth.start;
  const initialEvents: SaleEvent[] = [];

  if (vancouverOnHandSaleDate && vancouverOnHand > 0) {
    initialEvents.push({
      date: vancouverOnHandSaleDate,
      label: "Vancouver on hand",
      modules: vancouverOnHand,
      orders: averageModulesPerOrder ? Math.ceil(vancouverOnHand / averageModulesPerOrder) : null
    });
    nextAvailableSaleDate = addDays(vancouverOnHandSaleDate, 8);
  }

  return containers.reduce<SaleEvent[]>((events, item) => {
    if (!item.demandOpenDate || item.pieces <= 0) return events;

    const saleDate = laterDate(item.demandOpenDate, nextAvailableSaleDate);
    if (saleDate > selectedMonth.end) return events;

    events.push({
      date: saleDate,
      label: item.container.container_number,
      modules: item.pieces,
      orders: averageModulesPerOrder ? Math.ceil(item.pieces / averageModulesPerOrder) : null
    });
    nextAvailableSaleDate = addDays(saleDate, 8);
    return events;
  }, initialEvents);
}

function calculateDemandPlan({
  containers,
  customerAcquisitionCost,
  orders,
  selectedMonth,
  vancouverOnHand
}: {
  containers: ContainerEntry[];
  customerAcquisitionCost: number | null;
  orders: ShopifyOrder[];
  selectedMonth: MonthOption;
  vancouverOnHand: number;
}): DemandPlan {
  const today = new Date();
  const currentMonth = dateKey(today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const averageModulesPerOrder = calculateAverageModulesPerOrder(orders);
  const averageOrderValue = calculateAverageOrderValue(orders);
  const activeContainers = containers.filter((container) => container.status !== "closed");
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
  const nextDemandContainer = containerDemand.find((item) => {
    if (!item.demandOpenDate || !item.eta) return false;
    return item.eta >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }) || null;
  const selectedContainerPieces = containersEligibleThisMonth.reduce((sum, item) => sum + item.pieces, 0);
  const selectedVancouverOnHand = vancouverOnHand;
  const vancouverOnHandSaleDate = selectedVancouverOnHand > 0
    ? laterDate(todayStart, selectedMonth.start)
    : null;
  const saleEvents = buildSaleEvents({
    averageModulesPerOrder,
    containers: containersEligibleThisMonth,
    selectedMonth,
    vancouverOnHand: selectedVancouverOnHand,
    vancouverOnHandSaleDate
  });
  const targetModulesToSell = selectedVancouverOnHand + selectedContainerPieces;
  const targetOrdersToSell = averageModulesPerOrder
    ? Math.ceil(targetModulesToSell / averageModulesPerOrder)
    : null;

  return {
    averageModulesPerOrder,
    averageOrderValue,
    containersEligibleThisMonth,
    currentMonth,
    customerAcquisitionCost,
    daysUntilNextDemandWindow: nextDemandContainer?.demandOpenDate
      ? Math.max(0, daysBetween(today, nextDemandContainer.demandOpenDate))
      : null,
    maxRevenue: targetOrdersToSell !== null && averageOrderValue !== null
      ? targetOrdersToSell * averageOrderValue
      : null,
    nextDemandContainer,
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

function DemandAction({ plan }: { plan: DemandPlan }) {
  const waitDays = plan.daysUntilNextDemandWindow;
  const containerName = plan.nextDemandContainer?.container.container_number || "next container";

  return (
    <section className="rounded-[32px] border border-blue-100 bg-blue-50 p-6 shadow-sm lg:p-8">
      <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Next action</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
        {waitDays === null
          ? "No upcoming container demand window"
          : waitDays === 0
            ? `Demand window is open for ${containerName}`
            : `Wait ${waitDays} days for ${containerName}`}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Incoming inventory becomes eligible for advertising when its ETA to Canada is within {saleLeadDays} days. This uses live container ETAs, not a past-period filter.
      </p>
    </section>
  );
}

function MonthlyInventoryList({ plan }: { plan: DemandPlan }) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Inventory available to sell this month</h2>
      <div className="mt-5 divide-y divide-line text-sm">
        {plan.vancouverOnHand > 0 ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <span>
              <span className="block font-medium text-slate-700">Vancouver on hand</span>
              <span className="text-xs text-blue-700">Available now unless already sold</span>
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
                  Advertising opens {formatDate(item.demandOpenDate)}. ETA {formatDate(item.eta)}
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

function SaleCalendar({ plan }: { plan: DemandPlan }) {
  const daysInMonth = plan.selectedMonth.end.getDate();
  const firstDay = plan.selectedMonth.start.getDay();
  const cells: CalendarCell[] = [
    ...Array.from({ length: firstDay }, (_, index) => ({ date: null, event: null, key: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(plan.selectedMonth.start.getFullYear(), plan.selectedMonth.start.getMonth(), index + 1);
      const event = plan.saleEvents.find((saleEvent) => saleEvent.date.toDateString() === date.toDateString());

      return {
        date,
        event: event || null,
        key: date.toISOString()
      };
    })
  ];

  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">Sale calendar</h2>
        <p className="text-xs font-medium text-slate-500">7 blank days between sale starts</p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-normal text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => (
          <div
            className={[
              "min-h-24 rounded-xl border p-2 text-sm",
              cell.date ? "border-line bg-slate-50" : "border-transparent",
              cell.event ? "border-blue-200 bg-blue-50 shadow-sm" : ""
            ].join(" ")}
            key={cell.key}
          >
            {cell.date ? (
              <>
                <div className="font-semibold text-slate-700">{cell.date.getDate()}</div>
                {cell.event ? (
                  <div className="mt-2 rounded-lg bg-white p-2 text-left text-xs leading-5">
                    <div className="font-semibold text-blue-700">Sale</div>
                    <div className="font-medium text-slate-950">{cell.event.label}</div>
                    <div className="text-slate-500">{cell.event.modules} modules</div>
                    <div className="text-slate-500">{cell.event.orders ?? "Unavailable"} orders</div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
      {plan.saleEvents.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-slate-50 p-4 text-sm text-slate-500">
          No sale scheduled this month because no container inventory is inside the 20-day Canada ETA rule.
        </p>
      ) : null}
    </section>
  );
}

export default async function DemandPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthOptions = getMonthOptions(resolvedSearchParams?.month);
  const selectedMonth = monthOptions.find((option) => option.isActive) || monthOptions[0];
  const { supabase } = await requireUser();
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("inventory")
    .select("available_qty")
    .returns<Pick<InventoryRow, "available_qty">[]>();
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("created_at,total_modules,total_price")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<ShopifyOrder[]>();
  const { data: containers } = await supabase
    .from("container_entries")
    .select("*")
    .order("eta", { ascending: true, nullsFirst: false })
    .returns<ContainerEntry[]>();
  const wiseSummary = await getWiseSummary();

  const vancouverOnHand = (inventoryRows || []).reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const customerAcquisitionCost = calculateCustomerAcquisitionCost({
    metaExpenses: wiseSummary.metaSpend.expenses,
    orders: orders || []
  });
  const plan = calculateDemandPlan({
    containers: containers || [],
    customerAcquisitionCost,
    orders: orders || [],
    selectedMonth,
    vancouverOnHand
  });

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Demand plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            {selectedMonth.label}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Forward monthly sell plan based on live inventory, container ETAs, Shopify orders, and Wise Meta spend.
          </p>
        </div>
        <MonthSelector options={monthOptions} />
      </div>

      {inventoryError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load demand data.
        </section>
      ) : (
        <div className="space-y-5">
          <DemandAction plan={plan} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Maximum modules to sell" note="Vancouver on-hand plus containers inside the 20-day rule" value={plan.targetModulesToSell} />
            <StatCard label="Maximum orders to sell" note="Maximum modules / live avg modules per order" value={plan.targetOrdersToSell ?? "Unavailable"} />
            <StatCard label="Avg modules per order" note="From imported Shopify orders" value={plan.averageModulesPerOrder === null ? "Unavailable" : plan.averageModulesPerOrder.toFixed(1)} />
            <StatCard label="CAC" note="Wise Meta spend / Shopify orders" value={plan.customerAcquisitionCost === null ? "Unavailable" : money(plan.customerAcquisitionCost)} />
            <StatCard label="Required Meta budget" note="Maximum orders x live CAC" value={plan.targetMetaBudget === null ? "Unavailable" : money(plan.targetMetaBudget)} />
            <StatCard label="Max revenue" note="Maximum orders x live average order value" value={plan.maxRevenue === null ? "Unavailable" : money(plan.maxRevenue)} />
          </section>

          <SaleCalendar plan={plan} />
          <MonthlyInventoryList plan={plan} />
        </div>
      )}
    </main>
  );
}
