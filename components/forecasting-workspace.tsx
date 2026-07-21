"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type ModuleSlug = "corner" | "armless" | "ottoman";
type ForecastStatus = "Planning" | "Production" | "In transit" | "Received";

type InventoryItem = {
  color: string;
  module: ModuleSlug;
  onHand: number;
};

type PurchaseOrderItem = {
  color: string;
  module: ModuleSlug;
  quantity: number;
};

type PurchaseOrder = {
  id: string;
  factory: string;
  destination: string;
  crd: string;
  status: ForecastStatus;
  containerId?: string;
  items: PurchaseOrderItem[];
};

type ContainerShipment = {
  id: string;
  purchaseOrderIds: string[];
  origin: string;
  destination: string;
  departureDate: string;
  eta: string;
  status: "On water" | "At port" | "Customs" | "Delivered";
};

type PlanningTarget = {
  color: string;
  module: ModuleSlug;
  needed: number;
};

type ModuleTotals = Record<ModuleSlug, number>;
type ForecastView = "board" | "calendar";

type ColorSummary = {
  color: string;
  modules: ModuleTotals;
  total: number;
};

type ForecastSummary = {
  color: string;
  needed: ModuleTotals;
  projected: ModuleTotals;
  totalNeeded: number;
  totalProjected: number;
};

type SalePlan = {
  id: string;
  name: string;
  date: string;
  note: string;
  targets: ColorSummary[];
};

type CalendarEvent = {
  id: string;
  date: string;
  detail: string;
  moduleDelta: ModuleTotals;
  title: string;
  totalDelta: number;
  type: "container" | "sale";
};

type SelectedItem =
  | { type: "inventory"; color: string }
  | { type: "transit"; containerId: string }
  | { type: "purchase-order"; id: string }
  | { type: "forecast"; color: string }
  | { type: "sale"; id: string }
  | null;

const MODULES: ModuleSlug[] = ["corner", "armless", "ottoman"];
const COLORS = ["Off-white", "Dark grey", "Peach", "Aqua", "Jade"];

const CANADA_INVENTORY: InventoryItem[] = [
  { color: "Off-white", module: "corner", onHand: 34 },
  { color: "Off-white", module: "armless", onHand: 30 },
  { color: "Off-white", module: "ottoman", onHand: 22 },
  { color: "Dark grey", module: "corner", onHand: 30 },
  { color: "Dark grey", module: "armless", onHand: 12 },
  { color: "Dark grey", module: "ottoman", onHand: 17 },
  { color: "Peach", module: "corner", onHand: 16 },
  { color: "Peach", module: "armless", onHand: 8 },
  { color: "Peach", module: "ottoman", onHand: 8 },
  { color: "Aqua", module: "corner", onHand: 6 },
  { color: "Aqua", module: "armless", onHand: 4 },
  { color: "Aqua", module: "ottoman", onHand: 3 },
  { color: "Jade", module: "corner", onHand: 6 },
  { color: "Jade", module: "armless", onHand: 1 },
  { color: "Jade", module: "ottoman", onHand: 2 }
];

const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "PO-2607A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Aug 7, 2026",
    status: "In transit",
    containerId: "CONT-LUUN-0807",
    items: [
      { color: "Off-white", module: "corner", quantity: 40 },
      { color: "Off-white", module: "armless", quantity: 28 },
      { color: "Off-white", module: "ottoman", quantity: 20 },
      { color: "Dark grey", module: "corner", quantity: 28 },
      { color: "Dark grey", module: "armless", quantity: 18 },
      { color: "Dark grey", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2608A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Aug 28, 2026",
    status: "Production",
    items: [
      { color: "Peach", module: "corner", quantity: 32 },
      { color: "Peach", module: "armless", quantity: 20 },
      { color: "Peach", module: "ottoman", quantity: 14 },
      { color: "Aqua", module: "corner", quantity: 24 },
      { color: "Aqua", module: "armless", quantity: 18 },
      { color: "Aqua", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2609A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Sep 12, 2026",
    status: "Planning",
    items: [
      { color: "Jade", module: "corner", quantity: 30 },
      { color: "Jade", module: "armless", quantity: 22 },
      { color: "Jade", module: "ottoman", quantity: 16 }
    ]
  }
];

const CONTAINERS: ContainerShipment[] = [
  {
    id: "CONT-LUUN-0807",
    purchaseOrderIds: ["PO-2607A"],
    origin: "Ho Chi Minh City",
    destination: "Vancouver",
    departureDate: "Jul 14, 2026",
    eta: "Aug 7, 2026",
    status: "On water"
  }
];

const INITIAL_PLANNING_TARGETS: PlanningTarget[] = [
  { color: "Off-white", module: "corner", needed: 42 },
  { color: "Off-white", module: "armless", needed: 28 },
  { color: "Off-white", module: "ottoman", needed: 18 },
  { color: "Dark grey", module: "corner", needed: 34 },
  { color: "Dark grey", module: "armless", needed: 24 },
  { color: "Dark grey", module: "ottoman", needed: 22 },
  { color: "Peach", module: "corner", needed: 20 },
  { color: "Peach", module: "armless", needed: 12 },
  { color: "Peach", module: "ottoman", needed: 10 },
  { color: "Aqua", module: "corner", needed: 14 },
  { color: "Aqua", module: "armless", needed: 10 },
  { color: "Aqua", module: "ottoman", needed: 8 },
  { color: "Jade", module: "corner", needed: 12 },
  { color: "Jade", module: "armless", needed: 8 },
  { color: "Jade", module: "ottoman", needed: 6 }
];

const SALE_PLANS: SalePlan[] = [
  {
    id: "SALE-AUG-LABOUR",
    name: "Late August sale",
    date: "Aug 22, 2026",
    note: "Clear room before the next Canada receipt.",
    targets: [
      { color: "Off-white", modules: { armless: 10, corner: 14, ottoman: 8 }, total: 32 },
      { color: "Dark grey", modules: { armless: 8, corner: 12, ottoman: 8 }, total: 28 },
      { color: "Peach", modules: { armless: 4, corner: 6, ottoman: 4 }, total: 14 }
    ]
  },
  {
    id: "SALE-SEP-FALL",
    name: "Fall launch sale",
    date: "Sep 19, 2026",
    note: "Use after jade and aqua stock are replenished.",
    targets: [
      { color: "Aqua", modules: { armless: 8, corner: 10, ottoman: 6 }, total: 24 },
      { color: "Jade", modules: { armless: 8, corner: 12, ottoman: 6 }, total: 26 },
      { color: "Off-white", modules: { armless: 8, corner: 10, ottoman: 6 }, total: 24 }
    ]
  }
];

const EMPTY_TOTALS: ModuleTotals = { armless: 0, corner: 0, ottoman: 0 };

function emptyTotals(): ModuleTotals {
  return { ...EMPTY_TOTALS };
}

function moduleLabel(module: ModuleSlug) {
  return module === "armless" ? "Armless" : module.charAt(0).toUpperCase() + module.slice(1);
}

function totalModules(modules: ModuleTotals) {
  return MODULES.reduce((total, module) => total + modules[module], 0);
}

function statusClasses(status: ForecastStatus | ContainerShipment["status"]) {
  switch (status) {
    case "Received":
    case "Delivered":
      return "bg-emerald-100 text-emerald-800";
    case "In transit":
    case "On water":
    case "At port":
    case "Customs":
      return "bg-blue-100 text-blue-800";
    case "Production":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function summarizeInventory(items: InventoryItem[]): ColorSummary[] {
  return COLORS.map((color) => {
    const modules = emptyTotals();

    items
      .filter((item) => item.color === color)
      .forEach((item) => {
        modules[item.module] += item.onHand;
      });

    return { color, modules, total: totalModules(modules) };
  });
}

function summarizePurchaseItems(items: PurchaseOrderItem[]): ColorSummary[] {
  return COLORS.map((color) => {
    const modules = emptyTotals();

    items
      .filter((item) => item.color === color)
      .forEach((item) => {
        modules[item.module] += item.quantity;
      });

    return { color, modules, total: totalModules(modules) };
  }).filter((summary) => summary.total > 0);
}

function getContainerItems(container: ContainerShipment) {
  return PURCHASE_ORDERS.filter((purchaseOrder) => container.purchaseOrderIds.includes(purchaseOrder.id)).flatMap(
    (purchaseOrder) => purchaseOrder.items
  );
}

export function ForecastingWorkspace({ view = "board" }: { view?: ForecastView }) {
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [planningTargets, setPlanningTargets] = useState(INITIAL_PLANNING_TARGETS);

  const containerPurchaseOrderIds = useMemo(
    () => new Set(CONTAINERS.flatMap((container) => container.purchaseOrderIds)),
    []
  );

  const inventoryRows = useMemo(() => summarizeInventory(CANADA_INVENTORY), []);

  const transitRows = useMemo(
    () => summarizePurchaseItems(PURCHASE_ORDERS.filter((po) => containerPurchaseOrderIds.has(po.id)).flatMap((po) => po.items)),
    [containerPurchaseOrderIds]
  );

  const productionRows = useMemo(
    () =>
      summarizePurchaseItems(
        PURCHASE_ORDERS.filter((po) => po.status !== "Received" && !containerPurchaseOrderIds.has(po.id)).flatMap(
          (po) => po.items
        )
      ),
    [containerPurchaseOrderIds]
  );

  const forecastRows = useMemo<ForecastSummary[]>(() => {
    return COLORS.map((color) => {
      const onHand = inventoryRows.find((row) => row.color === color)?.modules ?? emptyTotals();
      const inTransit = transitRows.find((row) => row.color === color)?.modules ?? emptyTotals();
      const inProduction = productionRows.find((row) => row.color === color)?.modules ?? emptyTotals();
      const needed = emptyTotals();
      const projected = emptyTotals();

      MODULES.forEach((module) => {
        needed[module] =
          planningTargets.find((target) => target.color === color && target.module === module)?.needed ?? 0;
        projected[module] = onHand[module] + inTransit[module] + inProduction[module] - needed[module];
      });

      return {
        color,
        needed,
        projected,
        totalNeeded: totalModules(needed),
        totalProjected: totalModules(projected)
      };
    });
  }, [inventoryRows, planningTargets, productionRows, transitRows]);

  const selectedInventory = selected?.type === "inventory" ? inventoryRows.find((row) => row.color === selected.color) : null;
  const selectedForecast = selected?.type === "forecast" ? forecastRows.find((row) => row.color === selected.color) : null;
  const selectedPurchaseOrder =
    selected?.type === "purchase-order" ? PURCHASE_ORDERS.find((po) => po.id === selected.id) : null;
  const selectedContainer = selected?.type === "transit" ? CONTAINERS.find((container) => container.id === selected.containerId) : null;
  const selectedSale = selected?.type === "sale" ? SALE_PLANS.find((sale) => sale.id === selected.id) : null;

  const calendarEvents = useMemo(() => {
    return createCalendarEvents();
  }, []);

  const calendarProjection = useMemo(
    () => createCalendarProjection(inventoryRows, calendarEvents),
    [calendarEvents, inventoryRows]
  );

  function updatePlanningNeed(color: string, module: ModuleSlug, needed: number) {
    setPlanningTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.color === color && target.module === module ? { ...target, needed: Math.max(0, needed) } : target
      )
    );
  }

  return (
    <main className="min-h-[calc(100vh-32px)] rounded-[28px] bg-[#f7f8fb] p-4 text-zinc-950 sm:p-6 lg:p-8">
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Forecasting</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            {view === "board" ? "Supply planning board" : "Calendar forecast"}
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500">
          {view === "board"
            ? "Inventory, containers, purchase orders and forecast numbers are shown side by side."
            : "Incoming containers, sale timing, sell targets and projected inventory are shown by date."}
        </p>
      </header>

      {view === "board" ? (
        <section className="grid gap-4 xl:grid-cols-4">
          <BoardColumn
            title="Inventory on hand"
            total={inventoryRows.reduce((sum, row) => sum + row.total, 0)}
            subtitle="Canada warehouse"
          >
            <ModuleMatrix rows={inventoryRows} onOpen={(color) => setSelected({ color, type: "inventory" })} />
          </BoardColumn>

          <BoardColumn
            title="Inventory in transit"
            total={transitRows.reduce((sum, row) => sum + row.total, 0)}
            subtitle={`${CONTAINERS.length} active container`}
          >
            <div className="space-y-3">
              {CONTAINERS.map((container) => (
                <button
                  className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  key={container.id}
                  onClick={() => setSelected({ containerId: container.id, type: "transit" })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">{container.id}</div>
                      <div className="mt-1 text-xs text-zinc-500">ETA {container.eta}</div>
                    </div>
                    <StatusPill status={container.status} />
                  </div>
                </button>
              ))}
              <ModuleMatrix rows={transitRows} />
            </div>
          </BoardColumn>

          <BoardColumn
            title="Purchase orders"
            total={productionRows.reduce((sum, row) => sum + row.total, 0)}
            subtitle="Factory and planned POs"
          >
            <div className="space-y-3">
              {PURCHASE_ORDERS.map((po) => (
                <button
                  className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  key={po.id}
                  onClick={() => setSelected({ id: po.id, type: "purchase-order" })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">{po.id}</div>
                      <div className="mt-1 text-xs text-zinc-500">CRD {po.crd}</div>
                    </div>
                    <StatusPill status={po.status} />
                  </div>
                  <div className="mt-3 text-sm text-zinc-500">{totalModulesFromItems(po.items)} modules</div>
                </button>
              ))}
            </div>
          </BoardColumn>

          <BoardColumn
            title="Inventory forecasting"
            total={forecastRows.reduce((sum, row) => sum + row.totalProjected, 0)}
            subtitle="Projected after plan"
          >
            <div className="space-y-3">
              {forecastRows.map((row) => (
                <ForecastCard
                  key={row.color}
                  row={row}
                  onOpen={() => setSelected({ color: row.color, type: "forecast" })}
                  onUpdateNeed={updatePlanningNeed}
                />
              ))}
            </div>
          </BoardColumn>
        </section>
      ) : (
        <CalendarForecast
          events={calendarEvents}
          projection={calendarProjection}
          salePlans={SALE_PLANS}
          onOpenContainer={(containerId) => setSelected({ containerId, type: "transit" })}
          onOpenSale={(id) => setSelected({ id, type: "sale" })}
        />
      )}

      {selected ? (
        <>
          <button
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
            type="button"
          />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-full overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl sm:w-[460px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Details</div>
                <div className="mt-1 text-xl font-semibold">
                  {selectedInventory?.color ?? selectedForecast?.color ?? selectedPurchaseOrder?.id ?? selectedContainer?.id}
                  {selectedSale?.name}
                </div>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100"
                onClick={() => setSelected(null)}
                type="button"
              >
                x
              </button>
            </div>
            {selectedInventory ? <SummaryDrawer title="Inventory on hand" rows={[selectedInventory]} /> : null}
            {selectedForecast ? <ForecastDrawer row={selectedForecast} /> : null}
            {selectedPurchaseOrder ? <PurchaseOrderDrawer purchaseOrder={selectedPurchaseOrder} /> : null}
            {selectedContainer ? <ContainerDrawer container={selectedContainer} /> : null}
            {selectedSale ? <SaleDrawer sale={selectedSale} /> : null}
          </aside>
        </>
      ) : null}
    </main>
  );
}

function BoardColumn({
  children,
  subtitle,
  title,
  total
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
  total: number;
}) {
  return (
    <section className="min-h-[620px] rounded-[28px] border border-white bg-white/85 p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-zinc-950 px-3 py-2 text-right text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">Total</div>
          <div className="text-xl font-semibold">{total}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function ModuleMatrix({ onOpen, rows }: { onOpen?: (color: string) => void; rows: ColorSummary[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-100">
      <div className="grid grid-cols-[1.25fr_repeat(3,minmax(0,0.7fr))] bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <div>Colour</div>
        {MODULES.map((module) => (
          <div className="text-right" key={module}>
            {module === "armless" ? "Arm" : moduleLabel(module).slice(0, 3)}
          </div>
        ))}
      </div>
      <div className="divide-y divide-zinc-100">
        {rows.map((row) => {
          const content = (
            <>
              <div>
                <div className="font-semibold text-zinc-950">{row.color}</div>
                <div className="mt-1 text-xs text-zinc-500">{row.total} total</div>
              </div>
              {MODULES.map((module) => (
                <div className="text-right text-lg font-semibold text-zinc-900" key={module}>
                  {row.modules[module]}
                </div>
              ))}
            </>
          );

          if (!onOpen) {
            return (
              <div className="grid grid-cols-[1.25fr_repeat(3,minmax(0,0.7fr))] items-center gap-2 px-3 py-3" key={row.color}>
                {content}
              </div>
            );
          }

          return (
            <button
              className="grid w-full grid-cols-[1.25fr_repeat(3,minmax(0,0.7fr))] items-center gap-2 px-3 py-3 text-left transition hover:bg-blue-50"
              key={row.color}
              onClick={() => onOpen(row.color)}
              type="button"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ForecastCard({
  onOpen,
  onUpdateNeed,
  row
}: {
  onOpen: () => void;
  onUpdateNeed: (color: string, module: ModuleSlug, needed: number) => void;
  row: ForecastSummary;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
      <button className="w-full text-left" onClick={onOpen} type="button">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-zinc-950">{row.color}</div>
            <div className="mt-1 text-xs text-zinc-500">Need {row.totalNeeded}</div>
          </div>
          <div className={`text-2xl font-semibold ${row.totalProjected < 0 ? "text-red-600" : "text-zinc-950"}`}>
            {row.totalProjected}
          </div>
        </div>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MODULES.map((module) => (
          <label className="block" key={module}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {module === "armless" ? "Arm" : moduleLabel(module).slice(0, 3)}
            </span>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-center font-semibold outline-none focus:border-blue-500"
              min={0}
              onChange={(event) => onUpdateNeed(row.color, module, Number(event.target.value))}
              type="number"
              value={row.needed[module]}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-zinc-500">
        {MODULES.map((module) => (
          <div key={module}>
            Projected <span className="font-semibold text-zinc-950">{row.projected[module]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarForecast({
  events,
  onOpenContainer,
  onOpenSale,
  projection,
  salePlans
}: {
  events: CalendarEvent[];
  onOpenContainer: (containerId: string) => void;
  onOpenSale: (id: string) => void;
  projection: { date: string; projected: number; title: string }[];
  salePlans: SalePlan[];
}) {
  const monthlyEvents = groupEventsByMonth(events);
  const projectedEnd = projection[projection.length - 1]?.projected ?? 0;
  const totalSaleTarget = salePlans.reduce((total, sale) => total + sale.targets.reduce((sum, row) => sum + row.total, 0), 0);
  const totalIncoming = events.filter((event) => event.type === "container").reduce((total, event) => total + event.totalDelta, 0);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <MiniMetric label="Incoming containers" value={totalIncoming} />
          <MiniMetric label="Sale target" value={totalSaleTarget} />
          <MiniMetric label="Projected after calendar" value={projectedEnd} tone={projectedEnd < 0 ? "warning" : "normal"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {monthlyEvents.map((month) => (
            <section className="min-h-[520px] rounded-[28px] border border-white bg-white/85 p-4 shadow-sm" key={month.label}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{month.label}</h2>
                <p className="mt-1 text-sm text-zinc-500">{month.events.length} planning events</p>
              </div>
              <div className="space-y-3">
                {month.events.map((event) => (
                  <button
                    className={`w-full rounded-2xl border p-4 text-left transition hover:border-blue-200 ${
                      event.type === "container" ? "border-blue-100 bg-blue-50" : "border-amber-100 bg-amber-50"
                    }`}
                    key={event.id}
                    onClick={() => {
                      if (event.type === "container") onOpenContainer(event.id);
                      if (event.type === "sale") onOpenSale(event.id);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{event.date}</div>
                        <div className="mt-1 font-semibold text-zinc-950">{event.title}</div>
                        <div className="mt-1 text-sm text-zinc-600">{event.detail}</div>
                      </div>
                      <div className={`text-2xl font-semibold ${event.totalDelta < 0 ? "text-red-600" : "text-blue-700"}`}>
                        {event.totalDelta > 0 ? "+" : ""}
                        {event.totalDelta}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-zinc-600">
                      {MODULES.map((module) => (
                        <div className="rounded-xl bg-white/70 px-2 py-2" key={module}>
                          <div className="font-semibold text-zinc-500">
                            {module === "armless" ? "Arm" : moduleLabel(module).slice(0, 3)}
                          </div>
                          <div className="mt-1 text-base font-semibold text-zinc-950">{event.moduleDelta[module]}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="rounded-[28px] border border-white bg-white/85 p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Projection timeline</h2>
          <p className="mt-1 text-sm text-zinc-500">Inventory after each container or sale.</p>
        </div>
        <div className="space-y-3">
          {projection.map((point, index) => (
            <div className="relative rounded-2xl border border-zinc-100 bg-zinc-50 p-4" key={`${point.date}-${point.title}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {index === 0 ? "Start" : point.date}
                  </div>
                  <div className="mt-1 font-semibold text-zinc-950">{point.title}</div>
                </div>
                <div className={`text-2xl font-semibold ${point.projected < 0 ? "text-red-600" : "text-zinc-950"}`}>
                  {point.projected}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function MiniMetric({ label, tone = "normal", value }: { label: string; tone?: "normal" | "warning"; value: number }) {
  return (
    <div className="rounded-3xl border border-white bg-white/85 p-4 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${tone === "warning" ? "text-red-600" : "text-zinc-950"}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: ForecastStatus | ContainerShipment["status"] }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}>{status}</span>;
}

function totalModulesFromItems(items: PurchaseOrderItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function SummaryDrawer({ rows, title }: { rows: ColorSummary[]; title: string }) {
  return (
    <div className="space-y-6 p-5">
      <h3 className="font-semibold">{title}</h3>
      <ModuleMatrix rows={rows} />
    </div>
  );
}

function ForecastDrawer({ row }: { row: ForecastSummary }) {
  return (
    <div className="space-y-6 p-5">
      <DetailList
        rows={[
          ["Colour", row.color],
          ["Needed total", String(row.totalNeeded)],
          ["Projected total", String(row.totalProjected)]
        ]}
      />
      <section>
        <h3 className="font-semibold">Forecast by module</h3>
        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
          {MODULES.map((module) => (
            <div className="grid grid-cols-3 gap-3 border-b border-zinc-100 p-4 text-sm last:border-b-0" key={module}>
              <div className="font-semibold">{moduleLabel(module)}</div>
              <div className="text-zinc-500">Need {row.needed[module]}</div>
              <div className="text-right font-semibold">Projected {row.projected[module]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PurchaseOrderDrawer({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) {
  return (
    <div className="space-y-6 p-5">
      <DetailList
        rows={[
          ["Factory", purchaseOrder.factory],
          ["Destination", purchaseOrder.destination],
          ["CRD", purchaseOrder.crd],
          ["Status", purchaseOrder.status],
          ["Container", purchaseOrder.containerId ?? "Not containerized"]
        ]}
      />
      <SummaryDrawer rows={summarizePurchaseItems(purchaseOrder.items)} title="PO quantities" />
    </div>
  );
}

function ContainerDrawer({ container }: { container: ContainerShipment }) {
  const items = getContainerItems(container);

  return (
    <div className="space-y-6 p-5">
      <DetailList
        rows={[
          ["Origin", container.origin],
          ["Destination", container.destination],
          ["Departure", container.departureDate],
          ["ETA", container.eta],
          ["Status", container.status],
          ["Purchase orders", container.purchaseOrderIds.join(", ")]
        ]}
      />
      <SummaryDrawer rows={summarizePurchaseItems(items)} title="Container quantities" />
    </div>
  );
}

function SaleDrawer({ sale }: { sale: SalePlan }) {
  return (
    <div className="space-y-6 p-5">
      <DetailList
        rows={[
          ["Date", sale.date],
          ["Purpose", sale.note],
          ["Target pieces", String(sale.targets.reduce((total, row) => total + row.total, 0))]
        ]}
      />
      <SummaryDrawer rows={sale.targets} title="Sale target quantities" />
    </div>
  );
}

function DetailList({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      {rows.map(([label, value]) => (
        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 p-4 text-sm last:border-b-0" key={label}>
          <span className="text-zinc-500">{label}</span>
          <span className="text-right font-semibold text-zinc-900">{value}</span>
        </div>
      ))}
    </div>
  );
}

function createCalendarEvents(): CalendarEvent[] {
  const containerEvents = CONTAINERS.map((container) => {
    const items = getContainerItems(container);
    const moduleDelta = items.reduce<ModuleTotals>((totals, item) => {
      totals[item.module] += item.quantity;
      return totals;
    }, emptyTotals());

    return {
      date: container.eta,
      detail: `${container.origin} to ${container.destination}`,
      id: container.id,
      moduleDelta,
      title: `${container.id} arrives`,
      totalDelta: totalModules(moduleDelta),
      type: "container" as const
    };
  });

  const saleEvents = SALE_PLANS.map((sale) => {
    const moduleDelta = sale.targets.reduce<ModuleTotals>((totals, target) => {
      MODULES.forEach((module) => {
        totals[module] -= target.modules[module];
      });
      return totals;
    }, emptyTotals());

    return {
      date: sale.date,
      detail: sale.note,
      id: sale.id,
      moduleDelta,
      title: sale.name,
      totalDelta: totalModules(moduleDelta),
      type: "sale" as const
    };
  });

  return [...containerEvents, ...saleEvents].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function createCalendarProjection(inventoryRows: ColorSummary[], events: CalendarEvent[]) {
  let projected = inventoryRows.reduce((total, row) => total + row.total, 0);

  return [
    { date: "Today", projected, title: "Current Canada inventory" },
    ...events.map((event) => {
      projected += event.totalDelta;
      return {
        date: event.date,
        projected,
        title: event.title
      };
    })
  ];
}

function groupEventsByMonth(events: CalendarEvent[]) {
  return events.reduce<{ events: CalendarEvent[]; label: string }[]>((months, event) => {
    const eventDate = new Date(event.date);
    const label = eventDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const existingMonth = months.find((month) => month.label === label);

    if (existingMonth) {
      existingMonth.events.push(event);
    } else {
      months.push({ events: [event], label });
    }

    return months;
  }, []);
}
