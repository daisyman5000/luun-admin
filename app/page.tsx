import { requireUser } from "@/lib/auth";
import {
  CANADA_INVENTORY,
  COLORS,
  CONTAINERS,
  MODULES,
  PURCHASE_ORDERS,
  SALE_PLANS,
  createCalendarEvents,
  createCalendarProjection,
  emptyTotals,
  getContainerItems,
  moduleLabel,
  summarizeInventory,
  summarizePurchaseItems,
  type ColorSummary,
  type ModuleTotals
} from "@/lib/forecasting-data";
import type { ShopifyOrder } from "@/lib/types";

type ConversionRow = {
  color: string;
  inProduction: number;
  inTransit: number;
  onHand: number;
  plannedSale: number;
  projected: number;
};

type SaleCashRow = {
  date: string;
  name: string;
  pieces: number;
  value: number;
};

type CashEvent = {
  date: string;
  label: string;
  pieces: number;
  type: "arrival" | "purchase" | "sale";
  value: number;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function getOrderRevenue(order: Pick<ShopifyOrder, "total_price">) {
  return Number(order.total_price ?? 0);
}

function getOrderModules(order: Pick<ShopifyOrder, "total_modules">) {
  return Number(order.total_modules ?? 0);
}

function getAverageModuleValue(orders: Pick<ShopifyOrder, "total_modules" | "total_price">[]) {
  const revenue = orders.reduce((total, order) => total + getOrderRevenue(order), 0);
  const modules = orders.reduce((total, order) => total + getOrderModules(order), 0);

  if (modules <= 0) return 650;
  return revenue / modules;
}

function sumByColor(rows: ColorSummary[], color: string) {
  return rows.find((row) => row.color === color)?.total ?? 0;
}

function sumTargetsByColor(color: string) {
  return SALE_PLANS.reduce((total, sale) => {
    return total + (sale.targets.find((target) => target.color === color)?.total ?? 0);
  }, 0);
}

function buildConversionRows() {
  const containerPurchaseOrderIds = new Set(CONTAINERS.flatMap((container) => container.purchaseOrderIds));
  const inventoryRows = summarizeInventory(CANADA_INVENTORY);
  const transitRows = summarizePurchaseItems(
    PURCHASE_ORDERS.filter((po) => containerPurchaseOrderIds.has(po.id)).flatMap((po) => po.items)
  );
  const productionRows = summarizePurchaseItems(
    PURCHASE_ORDERS.filter((po) => po.status !== "Received" && !containerPurchaseOrderIds.has(po.id)).flatMap((po) => po.items)
  );

  return COLORS.map((color) => {
    const onHand = sumByColor(inventoryRows, color);
    const inTransit = sumByColor(transitRows, color);
    const inProduction = sumByColor(productionRows, color);
    const plannedSale = sumTargetsByColor(color);

    return {
      color,
      inProduction,
      inTransit,
      onHand,
      plannedSale,
      projected: onHand + inTransit + inProduction - plannedSale
    };
  });
}

function buildSaleCashRows(averageModuleValue: number) {
  return SALE_PLANS.map((sale) => {
    const pieces = sale.targets.reduce((total, target) => total + target.total, 0);

    return {
      date: sale.date,
      name: sale.name,
      pieces,
      value: pieces * averageModuleValue
    };
  });
}

function buildCashEvents(averageModuleValue: number) {
  const events = createCalendarEvents();

  return events.map<CashEvent>((event) => {
    const pieces = Math.abs(event.totalDelta);

    return {
      date: event.date,
      label: event.title,
      pieces,
      type: event.type === "container" ? "arrival" : event.type === "purchase-order" ? "purchase" : "sale",
      value: pieces * averageModuleValue
    };
  });
}

function buildProjectedModuleTimeline() {
  const inventoryRows = summarizeInventory(CANADA_INVENTORY);
  return createCalendarProjection(inventoryRows, createCalendarEvents());
}

function MetricTile({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function DashboardPanel({
  children,
  subtitle,
  title
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ConversionGraph({ averageModuleValue, rows }: { averageModuleValue: number; rows: ConversionRow[] }) {
  const maxValue = Math.max(...rows.map((row) => row.onHand + row.inTransit + row.inProduction), 1);

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        return (
          <div key={row.color}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{row.color}</div>
                <div className="text-xs text-slate-500">{currency(row.plannedSale * averageModuleValue)} planned conversion</div>
              </div>
              <div className="text-right text-sm font-semibold text-slate-700">{row.projected} projected left</div>
            </div>
            <div className="flex h-8 overflow-hidden rounded-xl bg-slate-50">
              <Segment color="bg-blue-600" max={maxValue} value={row.onHand} />
              <Segment color="bg-emerald-500" max={maxValue} value={row.inTransit} />
              <Segment color="bg-amber-500" max={maxValue} value={row.inProduction} />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-500">
              <span>On hand {row.onHand}</span>
              <span>Transit {row.inTransit}</span>
              <span>PO {row.inProduction}</span>
              <span>Sell {row.plannedSale}</span>
            </div>
          </div>
        );
      })}
      <Legend />
    </div>
  );
}

function Segment({ color, max, value }: { color: string; max: number; value: number }) {
  if (value <= 0) return null;

  return (
    <div
      className={`flex items-center justify-center text-[11px] font-semibold text-white ${color}`}
      style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
    >
      {value}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />On hand</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />In transit</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Purchase orders</span>
    </div>
  );
}

function SaleConversionGraph({ rows }: { rows: SaleCashRow[] }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">{row.name}</div>
              <div className="text-xs text-slate-500">{row.date} · {row.pieces} pieces</div>
            </div>
            <div className="text-sm font-semibold text-slate-700">{currency(row.value)}</div>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-50">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(row.value / maxValue) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineGraph({ rows }: { rows: { date: string; projected: number; title: string }[] }) {
  const maxProjected = Math.max(...rows.map((row) => row.projected), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div className="grid grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-3" key={`${row.date}-${row.title}`}>
          <div>
            <div className="text-sm font-semibold text-slate-800">{row.date}</div>
            <div className="truncate text-xs text-slate-500">{row.title}</div>
          </div>
          <div className="h-8 overflow-hidden rounded-xl bg-slate-50">
            <div className="h-full rounded-xl bg-violet-500" style={{ width: `${(row.projected / maxProjected) * 100}%` }} />
          </div>
          <div className="text-right text-lg font-semibold text-slate-900">{row.projected}</div>
        </div>
      ))}
    </div>
  );
}

function CashEventList({ rows }: { rows: CashEvent[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      {rows.map((row) => (
        <div className="grid gap-3 border-b border-line p-4 last:border-b-0 md:grid-cols-[112px_1fr_120px]" key={`${row.date}-${row.label}`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.date}</div>
            <div
              className={[
                "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                row.type === "sale" ? "bg-emerald-100 text-emerald-800" : "",
                row.type === "arrival" ? "bg-blue-100 text-blue-800" : "",
                row.type === "purchase" ? "bg-violet-100 text-violet-800" : ""
              ].join(" ")}
            >
              {row.type}
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.label}</div>
            <div className="mt-1 text-sm text-slate-500">{row.pieces} pieces tied to this forecast event</div>
          </div>
          <div className="text-right text-lg font-semibold text-slate-900">{currency(row.value)}</div>
        </div>
      ))}
    </div>
  );
}

function ModuleMixGraph({ rows }: { rows: ColorSummary[] }) {
  const totals = MODULES.reduce<ModuleTotals>((summary, module) => {
    summary[module] = rows.reduce((total, row) => total + row.modules[module], 0);
    return summary;
  }, emptyTotals());
  const max = Math.max(...MODULES.map((module) => totals[module]), 1);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {MODULES.map((module) => (
        <div className="rounded-2xl bg-slate-50 p-4" key={module}>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{moduleLabel(module)}</span>
            <span className="text-xl font-semibold text-slate-900">{totals[module]}</span>
          </div>
          <div className="h-32 overflow-hidden rounded-xl bg-white">
            <div
              className="mt-auto h-full rounded-xl bg-blue-600"
              style={{ height: `${Math.max(8, (totals[module] / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { supabase } = await requireUser();
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("created_at,total_modules,total_price")
    .order("created_at", { ascending: false })
    .limit(250)
    .returns<ShopifyOrder[]>();

  const safeOrders = orders ?? [];
  const averageModuleValue = getAverageModuleValue(safeOrders);
  const inventoryRows = summarizeInventory(CANADA_INVENTORY);
  const conversionRows = buildConversionRows();
  const saleRows = buildSaleCashRows(averageModuleValue);
  const cashEvents = buildCashEvents(averageModuleValue);
  const projectedTimeline = buildProjectedModuleTimeline();
  const onHandPieces = inventoryRows.reduce((total, row) => total + row.total, 0);
  const plannedSalePieces = SALE_PLANS.reduce((total, sale) => total + sale.targets.reduce((sum, row) => sum + row.total, 0), 0);
  const incomingPieces = CONTAINERS.reduce((total, container) => {
    return total + getContainerItems(container).reduce((sum, item) => sum + item.quantity, 0);
  }, 0);
  const plannedConversion = plannedSalePieces * averageModuleValue;
  const onHandValue = onHandPieces * averageModuleValue;

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Luun Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Cashflow conversion</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Home now uses the Forecasting plan as its source: inventory on hand, containers, purchase orders, and planned sales.
        </p>
      </div>

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Inventory ready to convert" note={`${onHandPieces} pieces on hand in forecast`} value={currency(onHandValue)} />
        <MetricTile label="Planned sale conversion" note={`${plannedSalePieces} pieces targeted in sale plans`} value={currency(plannedConversion)} />
        <MetricTile label="Incoming inventory" note={`${incomingPieces} pieces tied to active containers`} value={String(incomingPieces)} />
        <MetricTile label="Average module value" note="Calculated from imported Shopify orders when available" value={currency(averageModuleValue)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardPanel title="Forecast conversion by colour" subtitle="How much forecast inventory can turn into cash by colour.">
          <ConversionGraph averageModuleValue={averageModuleValue} rows={conversionRows} />
        </DashboardPanel>
        <DashboardPanel title="Sale cash targets" subtitle="Upcoming sale plans and the estimated cash they should recover.">
          <SaleConversionGraph rows={saleRows} />
        </DashboardPanel>
        <DashboardPanel title="Projected inventory runway" subtitle="How forecast pieces move after arrivals and planned sales.">
          <TimelineGraph rows={projectedTimeline} />
        </DashboardPanel>
        <DashboardPanel title="Module mix on hand" subtitle="What the forecast says is available to convert now.">
          <ModuleMixGraph rows={inventoryRows} />
        </DashboardPanel>
        <div className="xl:col-span-2">
          <DashboardPanel title="Cashflow events" subtitle="Forecast dates that matter for buying, receiving, and selling.">
            <CashEventList rows={cashEvents} />
          </DashboardPanel>
        </div>
      </section>
    </main>
  );
}
