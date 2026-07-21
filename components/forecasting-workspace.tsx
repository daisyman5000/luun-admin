"use client";

import { useMemo, useState } from "react";

type ModuleSlug = "corner" | "armless" | "ottoman";
type ForecastStatus = "Planning" | "Production" | "In transit" | "Received";
type ActiveView = "planning" | "purchase-orders" | "containers" | "inventory";

type InventoryItem = {
  sku: string;
  color: string;
  module: ModuleSlug;
  onHand: number;
};

type PurchaseOrderItem = {
  sku: string;
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

type PlanningRow = {
  color: string;
  module: ModuleSlug;
  sku: string;
  onHand: number;
  inProduction: number;
  inTransit: number;
  plannedNeed: number;
  projected: number;
};

type SelectedItem =
  | { type: "planning"; sku: string }
  | { type: "purchase-order"; id: string }
  | { type: "container"; id: string }
  | { type: "inventory"; sku: string }
  | null;

const CANADA_INVENTORY: InventoryItem[] = [
  { sku: "LCC-COR-WHITE", color: "Off-white", module: "corner", onHand: 34 },
  { sku: "LCC-SIDE-WHITE", color: "Off-white", module: "armless", onHand: 30 },
  { sku: "LCC-OTT-WHITE", color: "Off-white", module: "ottoman", onHand: 22 },
  { sku: "LCC-COR-GREY", color: "Dark grey", module: "corner", onHand: 30 },
  { sku: "LCC-SIDE-GREY", color: "Dark grey", module: "armless", onHand: 12 },
  { sku: "LCC-OTT-GREY", color: "Dark grey", module: "ottoman", onHand: 17 },
  { sku: "LCC-COR-PEACH", color: "Peach", module: "corner", onHand: 16 },
  { sku: "LCC-SIDE-PEACH", color: "Peach", module: "armless", onHand: 8 },
  { sku: "LCC-OTT-PEACH", color: "Peach", module: "ottoman", onHand: 8 },
  { sku: "LCC-COR-SKYBLUE", color: "Aqua", module: "corner", onHand: 6 },
  { sku: "LCC-SIDE-SKYBLUE", color: "Aqua", module: "armless", onHand: 4 },
  { sku: "LCC-OTT-SKYBLUE", color: "Aqua", module: "ottoman", onHand: 3 },
  { sku: "LCC-COR-BAMBOO", color: "Jade", module: "corner", onHand: 6 },
  { sku: "LCC-SIDE-BAMBOO", color: "Jade", module: "armless", onHand: 1 },
  { sku: "LCC-OTT-BAMBOO", color: "Jade", module: "ottoman", onHand: 2 }
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
      { sku: "LCC-COR-WHITE", color: "Off-white", module: "corner", quantity: 40 },
      { sku: "LCC-SIDE-WHITE", color: "Off-white", module: "armless", quantity: 28 },
      { sku: "LCC-OTT-WHITE", color: "Off-white", module: "ottoman", quantity: 20 },
      { sku: "LCC-COR-GREY", color: "Dark grey", module: "corner", quantity: 28 },
      { sku: "LCC-SIDE-GREY", color: "Dark grey", module: "armless", quantity: 18 },
      { sku: "LCC-OTT-GREY", color: "Dark grey", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2608A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Aug 28, 2026",
    status: "Production",
    items: [
      { sku: "LCC-COR-PEACH", color: "Peach", module: "corner", quantity: 32 },
      { sku: "LCC-SIDE-PEACH", color: "Peach", module: "armless", quantity: 20 },
      { sku: "LCC-OTT-PEACH", color: "Peach", module: "ottoman", quantity: 14 },
      { sku: "LCC-COR-SKYBLUE", color: "Aqua", module: "corner", quantity: 24 },
      { sku: "LCC-SIDE-SKYBLUE", color: "Aqua", module: "armless", quantity: 18 },
      { sku: "LCC-OTT-SKYBLUE", color: "Aqua", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2609A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Sep 12, 2026",
    status: "Planning",
    items: [
      { sku: "LCC-COR-BAMBOO", color: "Jade", module: "corner", quantity: 30 },
      { sku: "LCC-SIDE-BAMBOO", color: "Jade", module: "armless", quantity: 22 },
      { sku: "LCC-OTT-BAMBOO", color: "Jade", module: "ottoman", quantity: 16 }
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

const VIEWS: { id: ActiveView; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "purchase-orders", label: "Purchase orders" },
  { id: "containers", label: "Containers in transit" },
  { id: "inventory", label: "Stored inventory Canada" }
];

function getModuleLabel(module: ModuleSlug) {
  if (module === "armless") return "Armless";
  return module.charAt(0).toUpperCase() + module.slice(1);
}

function sumItems(items: PurchaseOrderItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function createQuantityMap(items: PurchaseOrderItem[]) {
  return items.reduce<Record<string, number>>((totals, item) => {
    totals[item.sku] = (totals[item.sku] ?? 0) + item.quantity;
    return totals;
  }, {});
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

function projectedClasses(projected: number) {
  if (projected < 0) return "text-red-600";
  if (projected <= 8) return "text-amber-600";
  return "text-zinc-950";
}

export function ForecastingWorkspace() {
  const [activeView, setActiveView] = useState<ActiveView>("planning");
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [planningTargets, setPlanningTargets] = useState(INITIAL_PLANNING_TARGETS);

  const containerPurchaseOrders = useMemo(
    () => new Set(CONTAINERS.flatMap((container) => container.purchaseOrderIds)),
    []
  );

  const inTransitItems = useMemo(
    () =>
      PURCHASE_ORDERS.filter((purchaseOrder) => containerPurchaseOrders.has(purchaseOrder.id)).flatMap(
        (purchaseOrder) => purchaseOrder.items
      ),
    [containerPurchaseOrders]
  );

  const inProductionItems = useMemo(
    () =>
      PURCHASE_ORDERS.filter(
        (purchaseOrder) =>
          purchaseOrder.status !== "Received" &&
          purchaseOrder.status !== "In transit" &&
          !containerPurchaseOrders.has(purchaseOrder.id)
      ).flatMap((purchaseOrder) => purchaseOrder.items),
    [containerPurchaseOrders]
  );

  const inTransitBySku = useMemo(() => createQuantityMap(inTransitItems), [inTransitItems]);
  const inProductionBySku = useMemo(() => createQuantityMap(inProductionItems), [inProductionItems]);

  const planningRows = useMemo<PlanningRow[]>(() => {
    return CANADA_INVENTORY.map((item) => {
      const plannedNeed =
        planningTargets.find((target) => target.color === item.color && target.module === item.module)?.needed ?? 0;
      const inProduction = inProductionBySku[item.sku] ?? 0;
      const inTransit = inTransitBySku[item.sku] ?? 0;
      const projected = item.onHand + inProduction + inTransit - plannedNeed;

      return {
        color: item.color,
        inProduction,
        inTransit,
        module: item.module,
        onHand: item.onHand,
        plannedNeed,
        projected,
        sku: item.sku
      };
    });
  }, [inProductionBySku, inTransitBySku, planningTargets]);

  const totals = useMemo(
    () =>
      planningRows.reduce(
        (summary, row) => {
          summary.onHand += row.onHand;
          summary.inProduction += row.inProduction;
          summary.inTransit += row.inTransit;
          summary.plannedNeed += row.plannedNeed;
          summary.projected += row.projected;
          if (row.projected < 0) summary.shortages += 1;
          return summary;
        },
        { inProduction: 0, inTransit: 0, onHand: 0, plannedNeed: 0, projected: 0, shortages: 0 }
      ),
    [planningRows]
  );

  const selectedPlanningRow = selected?.type === "planning" ? planningRows.find((row) => row.sku === selected.sku) : null;
  const selectedInventoryRow = selected?.type === "inventory" ? planningRows.find((row) => row.sku === selected.sku) : null;
  const selectedPurchaseOrder =
    selected?.type === "purchase-order" ? PURCHASE_ORDERS.find((purchaseOrder) => purchaseOrder.id === selected.id) : null;
  const selectedContainer =
    selected?.type === "container" ? CONTAINERS.find((container) => container.id === selected.id) : null;

  function updatePlanningNeed(color: string, module: ModuleSlug, needed: number) {
    setPlanningTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.color === color && target.module === module ? { ...target, needed: Math.max(0, needed) } : target
      )
    );
  }

  return (
    <main className="min-h-[calc(100vh-32px)] rounded-[28px] bg-[#f7f8fb] text-zinc-950">
      <div className="grid min-h-[calc(100vh-32px)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:border-b-0 lg:border-r">
          <div className="rounded-3xl border border-white bg-white/80 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Forecasting</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">Supply planning</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Planning, POs, transit and Canada inventory are connected here.
            </p>
          </div>
          <nav className="mt-4 space-y-2">
            {VIEWS.map((view) => (
              <button
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeView === view.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-white/70 text-zinc-700 hover:bg-white"
                }`}
                key={view.id}
                onClick={() => setActiveView(view.id)}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="grid gap-3 md:grid-cols-5">
            <MetricCard label="Canada on hand" value={totals.onHand} />
            <MetricCard label="In production" value={totals.inProduction} />
            <MetricCard label="In transit" value={totals.inTransit} />
            <MetricCard label="Planned need" value={totals.plannedNeed} />
            <MetricCard label="Projected after plan" value={totals.projected} warning={totals.shortages > 0} />
          </div>

          {activeView === "planning" ? (
            <PlanningTable
              rows={planningRows}
              onOpen={(sku) => setSelected({ sku, type: "planning" })}
              onUpdateNeed={updatePlanningNeed}
            />
          ) : null}

          {activeView === "purchase-orders" ? (
            <PurchaseOrdersTable
              purchaseOrders={PURCHASE_ORDERS}
              onOpen={(id) => setSelected({ id, type: "purchase-order" })}
            />
          ) : null}

          {activeView === "containers" ? (
            <ContainersTable containers={CONTAINERS} onOpen={(id) => setSelected({ id, type: "container" })} />
          ) : null}

          {activeView === "inventory" ? (
            <CanadaInventoryTable rows={planningRows} onOpen={(sku) => setSelected({ sku, type: "inventory" })} />
          ) : null}
        </section>
      </div>

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
                  {selectedPlanningRow?.sku ??
                    selectedInventoryRow?.sku ??
                    selectedPurchaseOrder?.id ??
                    selectedContainer?.id}
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
            {selectedPlanningRow ? <SkuDrawer row={selectedPlanningRow} /> : null}
            {selectedInventoryRow ? <SkuDrawer row={selectedInventoryRow} /> : null}
            {selectedPurchaseOrder ? <PurchaseOrderDrawer purchaseOrder={selectedPurchaseOrder} /> : null}
            {selectedContainer ? <ContainerDrawer container={selectedContainer} /> : null}
          </aside>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="rounded-3xl border border-white bg-white/85 p-4 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${warning ? "text-amber-600" : "text-zinc-950"}`}>{value}</div>
    </div>
  );
}

function PlanningTable({
  onOpen,
  onUpdateNeed,
  rows
}: {
  onOpen: (sku: string) => void;
  onUpdateNeed: (color: string, module: ModuleSlug, needed: number) => void;
  rows: PlanningRow[];
}) {
  return (
    <Panel title="Planning" subtitle="Edit the plan. Projected stock updates from Canada inventory, POs and containers.">
      <ResponsiveTable
        columns={["Colour", "Module", "On hand", "Production", "Transit", "Need", "Projected"]}
        rows={rows.map((row) => ({
          id: row.sku,
          onClick: () => onOpen(row.sku),
          cells: [
            <StrongText key="color" primary={row.color} secondary={row.sku} />,
            getModuleLabel(row.module),
            row.onHand,
            row.inProduction,
            row.inTransit,
            <input
              className="h-11 w-24 rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold outline-none focus:border-blue-500"
              key="need"
              min={0}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onUpdateNeed(row.color, row.module, Number(event.target.value))}
              type="number"
              value={row.plannedNeed}
            />,
            <span className={`text-lg font-semibold ${projectedClasses(row.projected)}`} key="projected">
              {row.projected}
            </span>
          ]
        }))}
      />
    </Panel>
  );
}

function PurchaseOrdersTable({
  onOpen,
  purchaseOrders
}: {
  onOpen: (id: string) => void;
  purchaseOrders: PurchaseOrder[];
}) {
  return (
    <Panel title="Purchase orders with CRD" subtitle="Open factory POs. Anything linked to a container becomes in transit.">
      <ResponsiveTable
        columns={["PO", "Factory", "Destination", "CRD", "Status", "Modules"]}
        rows={purchaseOrders.map((purchaseOrder) => ({
          id: purchaseOrder.id,
          onClick: () => onOpen(purchaseOrder.id),
          cells: [
            <StrongText key="po" primary={purchaseOrder.id} secondary={purchaseOrder.containerId ?? "Not containerized"} />,
            purchaseOrder.factory,
            purchaseOrder.destination,
            purchaseOrder.crd,
            <StatusPill key="status" status={purchaseOrder.status} />,
            sumItems(purchaseOrder.items)
          ]
        }))}
      />
    </Panel>
  );
}

function ContainersTable({
  containers,
  onOpen
}: {
  containers: ContainerShipment[];
  onOpen: (id: string) => void;
}) {
  return (
    <Panel title="Containers in transit" subtitle="Containers pull their SKU list from the purchase orders inside them.">
      <ResponsiveTable
        columns={["Container", "Origin", "Destination", "Departure", "ETA", "Status", "Modules"]}
        rows={containers.map((container) => ({
          id: container.id,
          onClick: () => onOpen(container.id),
          cells: [
            <StrongText key="container" primary={container.id} secondary={container.purchaseOrderIds.join(", ")} />,
            container.origin,
            container.destination,
            container.departureDate,
            container.eta,
            <StatusPill key="status" status={container.status} />,
            getContainerItems(container).reduce((total, item) => total + item.quantity, 0)
          ]
        }))}
      />
    </Panel>
  );
}

function CanadaInventoryTable({ onOpen, rows }: { onOpen: (sku: string) => void; rows: PlanningRow[] }) {
  return (
    <Panel title="Stored inventory Canada" subtitle="The current Canada stock position, using your real colour names.">
      <ResponsiveTable
        columns={["Colour", "Module", "SKU", "On hand", "Inbound", "Projected"]}
        rows={rows.map((row) => ({
          id: row.sku,
          onClick: () => onOpen(row.sku),
          cells: [
            row.color,
            getModuleLabel(row.module),
            row.sku,
            <span className="text-lg font-semibold" key="on-hand">
              {row.onHand}
            </span>,
            row.inProduction + row.inTransit,
            <span className={`text-lg font-semibold ${projectedClasses(row.projected)}`} key="projected">
              {row.projected}
            </span>
          ]
        }))}
      />
    </Panel>
  );
}

function Panel({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white bg-white/85 shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ResponsiveTable({
  columns,
  rows
}: {
  columns: string[];
  rows: { cells: React.ReactNode[]; id: string; onClick: () => void }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/80">
            {columns.map((column) => (
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr className="cursor-pointer transition hover:bg-blue-50/60" key={row.id} onClick={row.onClick}>
              {row.cells.map((cell, index) => (
                <td className="whitespace-nowrap px-5 py-4 text-sm text-zinc-700" key={`${row.id}-${index}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrongText({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div>
      <div className="font-semibold text-zinc-950">{primary}</div>
      <div className="mt-1 text-xs text-zinc-500">{secondary}</div>
    </div>
  );
}

function StatusPill({ status }: { status: ForecastStatus | ContainerShipment["status"] }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}>{status}</span>;
}

function SkuDrawer({ row }: { row: PlanningRow }) {
  return (
    <div className="space-y-6 p-5">
      <div className="grid grid-cols-2 gap-3">
        <DrawerMetric label="Canada on hand" value={row.onHand} />
        <DrawerMetric label="In production" value={row.inProduction} />
        <DrawerMetric label="In transit" value={row.inTransit} />
        <DrawerMetric label="Projected" value={row.projected} />
      </div>
      <DetailList
        rows={[
          ["Colour", row.color],
          ["Module", getModuleLabel(row.module)],
          ["SKU", row.sku],
          ["Planned need", String(row.plannedNeed)]
        ]}
      />
      <LinkedPurchaseOrders sku={row.sku} />
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
      <ItemsList items={purchaseOrder.items} title="PO contents" />
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
      <ItemsList items={items} title="Container contents" />
    </div>
  );
}

function DrawerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
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

function ItemsList({ items, title }: { items: PurchaseOrderItem[]; title: string }) {
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 p-4 last:border-b-0" key={`${item.sku}-${item.quantity}`}>
            <div>
              <div className="font-semibold">{item.color}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {getModuleLabel(item.module)} - {item.sku}
              </div>
            </div>
            <div className="text-2xl font-semibold">{item.quantity}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinkedPurchaseOrders({ sku }: { sku: string }) {
  const matches = PURCHASE_ORDERS.filter((purchaseOrder) => purchaseOrder.items.some((item) => item.sku === sku));

  return (
    <section>
      <h3 className="font-semibold">Related purchase orders</h3>
      <div className="mt-3 space-y-2">
        {matches.map((purchaseOrder) => {
          const itemQuantity = purchaseOrder.items.find((item) => item.sku === sku)?.quantity ?? 0;
          return (
            <div className="rounded-2xl border border-zinc-200 p-4" key={purchaseOrder.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{purchaseOrder.id}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {purchaseOrder.crd} - {purchaseOrder.containerId ?? purchaseOrder.status}
                  </div>
                </div>
                <div className="text-2xl font-semibold">{itemQuantity}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getContainerItems(container: ContainerShipment) {
  return PURCHASE_ORDERS.filter((purchaseOrder) => container.purchaseOrderIds.includes(purchaseOrder.id)).flatMap(
    (purchaseOrder) => purchaseOrder.items
  );
}
