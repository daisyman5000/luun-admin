"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CANADA_INVENTORY,
  COLORS,
  CONTAINERS,
  INITIAL_PLANNING_TARGETS,
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
  totalModules,
  type CalendarEvent,
  type ColorSummary,
  type ContainerShipment,
  type ForecastStatus,
  type ForecastView,
  type ModuleSlug,
  type ModuleTotals,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type SalePlan
} from "@/lib/forecasting-data";

type ForecastSummary = {
  color: string;
  needed: ModuleTotals;
  projected: ModuleTotals;
  totalNeeded: number;
  totalProjected: number;
};

type SelectedItem =
  | { type: "inventory"; color: string }
  | { type: "transit"; containerId: string }
  | { type: "purchase-order"; id: string }
  | { type: "forecast"; color: string }
  | { type: "sale"; id: string }
  | null;

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
          onOpenPurchaseOrder={(id) => setSelected({ id, type: "purchase-order" })}
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
  onOpenPurchaseOrder,
  onOpenSale,
  projection,
  salePlans
}: {
  events: CalendarEvent[];
  onOpenContainer: (containerId: string) => void;
  onOpenPurchaseOrder: (id: string) => void;
  onOpenSale: (id: string) => void;
  projection: { date: string; projected: number; title: string }[];
  salePlans: SalePlan[];
}) {
  const monthlyEvents = groupEventsByMonth(events);
  const totalSaleTarget = salePlans.reduce((total, sale) => total + sale.targets.reduce((sum, row) => sum + row.total, 0), 0);
  const totalIncoming = events.filter((event) => event.type === "container").reduce((total, event) => total + event.totalDelta, 0);
  const purchaseOrderEvents = events.filter((event) => event.type === "purchase-order").length;

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {monthlyEvents.map((month) => (
          <section className="rounded-[28px] border border-white bg-white/85 p-4 shadow-sm" key={month.label}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{month.label}</h2>
                <p className="mt-1 text-sm text-zinc-500">{month.events.length} highlighted dates</p>
              </div>
              <div className="flex gap-1">
                <LegendDot tone="blue" />
                <LegendDot tone="amber" />
                <LegendDot tone="violet" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div className="py-1" key={day}>
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildMonthDays(month.events).map((day, index) =>
                day ? (
                  <div
                    className={`min-h-24 rounded-2xl border p-2 ${
                      day.events.length > 0 ? "border-blue-100 bg-white shadow-sm" : "border-zinc-100 bg-zinc-50/70"
                    }`}
                    key={day.iso}
                  >
                    <div className="mb-1 text-left text-sm font-semibold text-zinc-800">{day.date.getDate()}</div>
                    <div className="space-y-1">
                      {day.events.map((event) => (
                        <button
                          className={`block w-full truncate rounded-lg px-2 py-1 text-left text-[11px] font-semibold ${eventBadgeClasses(
                            event.type
                          )}`}
                          key={event.id}
                          onClick={() => {
                            if (event.type === "container") onOpenContainer(event.id);
                            if (event.type === "purchase-order" && event.purchaseOrderId) onOpenPurchaseOrder(event.purchaseOrderId);
                            if (event.type === "sale") onOpenSale(event.id);
                          }}
                          title={event.title}
                          type="button"
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-24" key={`blank-${month.label}-${index}`} />
                )
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[28px] border border-white bg-white/85 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Stakeholder summary</h2>
              <p className="mt-1 text-sm text-zinc-500">Dates that matter for buying, receiving and selling inventory.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <SummaryPill label="Incoming" value={totalIncoming} />
              <SummaryPill label="Sell target" value={totalSaleTarget} />
              <SummaryPill label="PO dates" value={purchaseOrderEvents} />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            {events.map((event) => (
              <button
                className="grid w-full gap-3 border-b border-zinc-100 p-4 text-left last:border-b-0 hover:bg-blue-50 md:grid-cols-[120px_1fr_110px]"
                key={event.id}
                onClick={() => {
                  if (event.type === "container") onOpenContainer(event.id);
                  if (event.type === "purchase-order" && event.purchaseOrderId) onOpenPurchaseOrder(event.purchaseOrderId);
                  if (event.type === "sale") onOpenSale(event.id);
                }}
                type="button"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{event.date}</div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${eventBadgeClasses(event.type)}`}>
                    {event.type === "purchase-order" ? "Purchase" : event.type}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-zinc-950">{event.title}</div>
                  <div className="mt-1 text-sm text-zinc-500">{event.detail}</div>
                </div>
                <div className={`text-right text-2xl font-semibold ${event.totalDelta < 0 ? "text-red-600" : "text-blue-700"}`}>
                  {event.totalDelta > 0 ? "+" : ""}
                  {event.totalDelta}
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-[28px] border border-white bg-white/85 p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Projection</h2>
            <p className="mt-1 text-sm text-zinc-500">Total pieces after each highlighted date.</p>
          </div>
          <div className="space-y-3">
            {projection.map((point, index) => (
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4" key={`${point.date}-${point.title}`}>
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
      </div>
    </section>
  );
}

function LegendDot({ tone }: { tone: "amber" | "blue" | "violet" }) {
  const classes = {
    amber: "bg-amber-400",
    blue: "bg-blue-500",
    violet: "bg-violet-500"
  };

  return <span className={`h-2.5 w-2.5 rounded-full ${classes[tone]}`} />;
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function eventBadgeClasses(type: CalendarEvent["type"]) {
  if (type === "container") return "bg-blue-100 text-blue-800";
  if (type === "purchase-order") return "bg-violet-100 text-violet-800";
  return "bg-amber-100 text-amber-800";
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

function buildMonthDays(events: CalendarEvent[]) {
  const firstEventDate = new Date(events[0]?.date ?? new Date());
  const monthStart = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1);
  const monthEnd = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth() + 1, 0);
  const days: ({ date: Date; events: CalendarEvent[]; iso: string } | null)[] = [];

  for (let index = 0; index < monthStart.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), day);
    const iso = date.toISOString().slice(0, 10);

    days.push({
      date,
      events: events.filter((event) => new Date(event.date).toISOString().slice(0, 10) === iso),
      iso
    });
  }

  return days;
}
