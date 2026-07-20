"use client";

import type { LogisticsSelection, LogisticsSkuQuantity } from "@/types/logistics";

type LogisticsDetailsPanelProps = {
  selection: LogisticsSelection;
  onClose: () => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function InventoryGroup({
  title,
  rows
}: {
  title: string;
  rows: LogisticsSkuQuantity[];
}) {
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {total}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-slate-50 px-3 py-2"
            key={`${title}-${row.sku}`}
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{row.colour}</p>
              <p className="text-xs text-slate-500">
                {row.sku} · {row.module}
              </p>
            </div>
            <p className="text-base font-semibold text-slate-900">{row.quantity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LogisticsDetailsPanel({
  selection,
  onClose
}: LogisticsDetailsPanelProps) {
  const isWarehouse = selection.type === "warehouse";

  return (
    <aside className="absolute inset-x-0 bottom-0 z-20 max-h-[78vh] overflow-y-auto rounded-t-3xl border border-white/20 bg-white/95 p-5 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:w-[420px] lg:rounded-3xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-blue-700">
            {isWarehouse ? "Warehouse" : "Container"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-900">
            {isWarehouse ? selection.item.name : selection.item.containerNumber}
          </h2>
        </div>
        <button
          className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      {isWarehouse ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {selection.item.city}, {selection.item.country}
          </p>
          <InventoryGroup rows={selection.item.availableInventory} title="Available inventory" />
          <InventoryGroup rows={selection.item.reservedInventory} title="Reserved inventory" />
          <InventoryGroup rows={selection.item.inboundInventory} title="Inbound inventory" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-line bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Origin</span>
              <span className="font-semibold text-slate-900">{selection.item.origin.city}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Destination</span>
              <span className="font-semibold text-slate-900">
                {selection.item.destination.city}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Departure</span>
              <span className="font-semibold text-slate-900">
                {formatDate(selection.item.departure_at)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ETA</span>
              <span className="font-semibold text-slate-900">
                {formatDate(selection.item.estimated_arrival_at)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Status</span>
              <span className="font-semibold text-slate-900">{selection.item.status}</span>
            </div>
          </div>
          <InventoryGroup rows={selection.item.skuQuantities} title="Container SKUs" />
        </div>
      )}
    </aside>
  );
}
