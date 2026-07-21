"use client";

import { useMemo, useState } from "react";

type InventoryItem = {
  id: string;
  product: string;
  color: string;
  onHand: number;
  reserved: number;
};

type Location = {
  id: string;
  name: string;
  subtitle: string;
  type: "warehouse" | "factory";
  inventory: InventoryItem[];
};

type PurchaseOrderItem = {
  product: string;
  color: string;
  quantity: number;
};

type PurchaseOrder = {
  id: string;
  factory: string;
  destination: string;
  crd: string;
  status: "Materials" | "Production" | "Final QC" | "Ready";
  progress: number;
  items: PurchaseOrderItem[];
};

type SelectedItem =
  | { type: "location"; id: string }
  | { type: "purchase-order"; id: string }
  | null;

const LOCATIONS: Location[] = [
  {
    id: "vancouver",
    name: "Vancouver",
    subtitle: "Canada warehouse",
    type: "warehouse",
    inventory: [
      { id: "vancouver-corner-white", product: "Corner", color: "Off-white", onHand: 27, reserved: 4 },
      { id: "vancouver-armless-white", product: "Armless", color: "Off-white", onHand: 24, reserved: 3 },
      { id: "vancouver-ottoman-white", product: "Ottoman", color: "Off-white", onHand: 19, reserved: 2 },
      { id: "vancouver-corner-grey", product: "Corner", color: "Dark grey", onHand: 9, reserved: 2 },
      { id: "vancouver-armless-grey", product: "Armless", color: "Dark grey", onHand: 1, reserved: 0 },
      { id: "vancouver-ottoman-grey", product: "Ottoman", color: "Dark grey", onHand: 7, reserved: 1 }
    ]
  },
  {
    id: "seattle",
    name: "Seattle",
    subtitle: "United States warehouse",
    type: "warehouse",
    inventory: [
      { id: "seattle-corner-grey", product: "Corner", color: "Dark grey", onHand: 24, reserved: 0 },
      { id: "seattle-armless-grey", product: "Armless", color: "Dark grey", onHand: 16, reserved: 0 },
      { id: "seattle-ottoman-grey", product: "Ottoman", color: "Dark grey", onHand: 8, reserved: 0 }
    ]
  },
  {
    id: "vietnam-factory",
    name: "Vietnam Factory",
    subtitle: "Production location",
    type: "factory",
    inventory: []
  }
];

const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "PO-2607A",
    factory: "Vietnam Factory",
    destination: "Vancouver",
    crd: "August 7, 2026",
    status: "Final QC",
    progress: 85,
    items: [
      { product: "Corner", color: "Dark grey", quantity: 71 },
      { product: "Armless", color: "Dark grey", quantity: 40 },
      { product: "Ottoman", color: "Dark grey", quantity: 29 }
    ]
  },
  {
    id: "PO-2607B",
    factory: "Vietnam Factory",
    destination: "Seattle",
    crd: "August 18, 2026",
    status: "Production",
    progress: 52,
    items: [
      { product: "Corner", color: "Off-white", quantity: 71 },
      { product: "Armless", color: "Off-white", quantity: 40 },
      { product: "Ottoman", color: "Off-white", quantity: 29 }
    ]
  },
  {
    id: "PO-2608A",
    factory: "Vietnam Factory",
    destination: "Vancouver",
    crd: "September 2, 2026",
    status: "Materials",
    progress: 18,
    items: [
      { product: "Corner", color: "Dark grey", quantity: 71 },
      { product: "Armless", color: "Dark grey", quantity: 40 },
      { product: "Ottoman", color: "Dark grey", quantity: 29 }
    ]
  }
];

function getLocationTotals(location: Location) {
  return location.inventory.reduce(
    (totals, item) => {
      totals.onHand += item.onHand;
      totals.reserved += item.reserved;
      totals.available += Math.max(0, item.onHand - item.reserved);
      return totals;
    },
    { available: 0, onHand: 0, reserved: 0 }
  );
}

function getPurchaseOrderTotal(purchaseOrder: PurchaseOrder) {
  return purchaseOrder.items.reduce((total, item) => total + item.quantity, 0);
}

function getStatusStyles(status: PurchaseOrder["status"]) {
  switch (status) {
    case "Ready":
      return "bg-emerald-100 text-emerald-800";
    case "Final QC":
      return "bg-amber-100 text-amber-800";
    case "Production":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function getStockStyles(available: number) {
  if (available <= 2) return "text-red-600";
  if (available <= 8) return "text-amber-600";
  return "text-zinc-950";
}

export function ForecastingWorkspace() {
  const [selected, setSelected] = useState<SelectedItem>(null);

  const selectedLocation = useMemo(() => {
    if (selected?.type !== "location") return null;
    return LOCATIONS.find((location) => location.id === selected.id) ?? null;
  }, [selected]);

  const selectedPurchaseOrder = useMemo(() => {
    if (selected?.type !== "purchase-order") return null;
    return PURCHASE_ORDERS.find((purchaseOrder) => purchaseOrder.id === selected.id) ?? null;
  }, [selected]);

  return (
    <main className="min-h-[calc(100vh-32px)] rounded-3xl bg-[#f5f5f2] p-4 text-zinc-950 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <section>
          <div className="mb-3">
            <h1 className="text-lg font-semibold">Inventory locations</h1>
            <p className="mt-1 text-sm text-zinc-500">Click a warehouse to see its inventory.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {LOCATIONS.map((location) => {
              const totals = getLocationTotals(location);
              return (
                <button
                  className="rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-400"
                  key={location.id}
                  onClick={() => setSelected({ id: location.id, type: "location" })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{location.name}</div>
                      <div className="mt-1 text-sm text-zinc-500">{location.subtitle}</div>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                      {location.type === "warehouse" ? "Warehouse" : "Factory"}
                    </span>
                  </div>
                  {location.type === "warehouse" ? (
                    <div className="mt-8 grid grid-cols-3 gap-3">
                      <Metric label="On hand" value={totals.onHand} />
                      <Metric label="Available" value={totals.available} />
                      <Metric label="Reserved" value={totals.reserved} />
                    </div>
                  ) : (
                    <div className="mt-8">
                      <div className="text-xs text-zinc-500">Open purchase orders</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {PURCHASE_ORDERS.filter((purchaseOrder) => purchaseOrder.factory === location.name).length}
                      </div>
                    </div>
                  )}
                  <div className="mt-6 text-sm font-medium">View details -&gt;</div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Purchase orders</h2>
            <p className="mt-1 text-sm text-zinc-500">Click a PO to see its contents, factory status and CRD.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[1fr_1fr_1fr_1.3fr_40px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 md:grid">
              <div>Purchase order</div>
              <div>Destination</div>
              <div>CRD</div>
              <div>Status</div>
              <div />
            </div>
            <div className="divide-y divide-zinc-200">
              {PURCHASE_ORDERS.map((purchaseOrder) => {
                const total = getPurchaseOrderTotal(purchaseOrder);
                return (
                  <button
                    className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 md:grid-cols-[1fr_1fr_1fr_1.3fr_40px] md:items-center"
                    key={purchaseOrder.id}
                    onClick={() => setSelected({ id: purchaseOrder.id, type: "purchase-order" })}
                    type="button"
                  >
                    <div>
                      <div className="font-semibold">{purchaseOrder.id}</div>
                      <div className="mt-1 text-sm text-zinc-500">{total} modules</div>
                    </div>
                    <Field label="Destination" value={purchaseOrder.destination} />
                    <Field label="CRD" value={purchaseOrder.crd} />
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyles(purchaseOrder.status)}`}>
                          {purchaseOrder.status}
                        </span>
                        <span className="text-xs text-zinc-500">{purchaseOrder.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-zinc-900" style={{ width: `${purchaseOrder.progress}%` }} />
                      </div>
                    </div>
                    <div className="text-right text-zinc-400">›</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {selected ? (
        <>
          <button
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelected(null)}
            type="button"
          />
          <aside className="fixed bottom-0 right-0 top-0 z-50 w-full overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl sm:w-[430px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Details</div>
                <div className="mt-1 text-lg font-semibold">{selectedLocation?.name ?? selectedPurchaseOrder?.id}</div>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100"
                onClick={() => setSelected(null)}
                type="button"
              >
                ×
              </button>
            </div>
            {selectedLocation ? <LocationDrawer location={selectedLocation} /> : null}
            {selectedPurchaseOrder ? <PurchaseOrderDrawer purchaseOrder={selectedPurchaseOrder} /> : null}
          </aside>
        </>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 md:hidden">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function LocationDrawer({ location }: { location: Location }) {
  const totals = getLocationTotals(location);
  const incomingPurchaseOrders = PURCHASE_ORDERS.filter((purchaseOrder) => purchaseOrder.destination === location.name);

  return (
    <div className="space-y-7 p-5">
      {location.type === "warehouse" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="On hand" value={totals.onHand} />
            <SummaryCard label="Available" value={totals.available} />
            <SummaryCard label="Reserved" value={totals.reserved} />
          </div>
          <section>
            <h3 className="font-semibold">Inventory</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              {location.inventory.map((item) => {
                const available = Math.max(0, item.onHand - item.reserved);
                return (
                  <div className="border-b border-zinc-200 p-4 last:border-b-0" key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.product}</div>
                        <div className="mt-1 text-sm text-zinc-500">{item.color}</div>
                      </div>
                      <div className={`text-2xl font-semibold ${getStockStyles(available)}`}>{available}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <SmallValue label="On hand" value={item.onHand} />
                      <SmallValue label="Reserved" value={item.reserved} />
                      <SmallValue label="Available" value={available} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Incoming purchase orders</h3>
              <span className="text-sm text-zinc-500">{incomingPurchaseOrders.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {incomingPurchaseOrders.length > 0 ? (
                incomingPurchaseOrders.map((purchaseOrder) => (
                  <IncomingPurchaseOrder purchaseOrder={purchaseOrder} key={purchaseOrder.id} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                  No incoming purchase orders.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h3 className="font-semibold">Open purchase orders</h3>
          <div className="mt-3 space-y-2">
            {PURCHASE_ORDERS.filter((purchaseOrder) => purchaseOrder.factory === location.name).map((purchaseOrder) => (
              <div className="rounded-xl border border-zinc-200 p-4" key={purchaseOrder.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{purchaseOrder.id}</div>
                    <div className="mt-1 text-sm text-zinc-500">To {purchaseOrder.destination}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{purchaseOrder.crd}</div>
                    <div className="mt-1 text-xs text-zinc-500">CRD</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SmallValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function IncomingPurchaseOrder({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">{purchaseOrder.id}</div>
          <div className="mt-1 text-sm text-zinc-500">CRD {purchaseOrder.crd}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyles(purchaseOrder.status)}`}>
          {purchaseOrder.status}
        </span>
      </div>
    </div>
  );
}

function PurchaseOrderDrawer({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) {
  const total = getPurchaseOrderTotal(purchaseOrder);

  return (
    <div className="space-y-7 p-5">
      <div className="rounded-2xl bg-zinc-100 p-4">
        <div className="flex items-center justify-between gap-4">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyles(purchaseOrder.status)}`}>
            {purchaseOrder.status}
          </span>
          <span className="text-sm font-medium">{purchaseOrder.progress}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-zinc-900" style={{ width: `${purchaseOrder.progress}%` }} />
        </div>
      </div>
      <section>
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <DetailRow label="Factory" value={purchaseOrder.factory} />
          <DetailRow label="Destination" value={purchaseOrder.destination} />
          <DetailRow label="CRD" value={purchaseOrder.crd} />
          <DetailRow label="Total modules" value={String(total)} />
        </div>
      </section>
      <section>
        <h3 className="font-semibold">PO contents</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
          {purchaseOrder.items.map((item, index) => (
            <div
              className={`flex items-center justify-between gap-4 p-4 ${index < purchaseOrder.items.length - 1 ? "border-b border-zinc-200" : ""}`}
              key={`${item.product}-${item.color}`}
            >
              <div>
                <div className="font-medium">{item.product}</div>
                <div className="mt-1 text-sm text-zinc-500">{item.color}</div>
              </div>
              <div className="text-2xl font-semibold">{item.quantity}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200 p-4 text-sm last:border-b-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
