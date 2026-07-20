"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import type { ShopifyOrder } from "@/lib/types";

type EditableOrderField =
  | "delegate_order_id"
  | "postal_code"
  | "carrier"
  | "delegate_order_created_at"
  | "delivered_at"
  | "delivery_status"
  | "logistics_status"
  | "internal_notes";

function addressPart(order: ShopifyOrder, key: "country" | "province" | "province_code" | "zip") {
  const address = order.shipping_address_json;
  const value = address?.[key];
  return typeof value === "string" ? value : "";
}

function monthKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  if (key === "unknown") return "Unknown";
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function CustomerCell({ order }: { order: ShopifyOrder }) {
  const province = addressPart(order, "province") || addressPart(order, "province_code");
  const country = addressPart(order, "country");
  const postalCode = order.postal_code || addressPart(order, "zip");

  return (
    <div className="group min-w-56">
      <div className="font-semibold text-slate-900">{order.customer_name || "No name"}</div>
      <details className="mt-2 inline-block">
        <summary className="cursor-pointer list-none rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Details
        </summary>
        <div className="mt-2 w-80 rounded-xl border border-line bg-white p-4 text-sm shadow-sm">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">Email</dt>
              <dd className="mt-1 break-words text-slate-800">{order.customer_email || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">Phone</dt>
              <dd className="mt-1 text-slate-800">{order.customer_phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">Postal code</dt>
              <dd className="mt-1 text-slate-800">{postalCode || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">Country / province</dt>
              <dd className="mt-1 text-slate-800">
                {[country, province].filter(Boolean).join(" / ") || "-"}
              </dd>
            </div>
          </dl>
        </div>
      </details>
      <div className="pointer-events-none mt-2 hidden w-80 rounded-xl border border-line bg-white p-4 text-sm shadow-sm group-hover:block group-focus-within:hidden">
        <p className="break-words text-slate-700">{order.customer_email || "No email"}</p>
        <p className="mt-1 text-slate-700">{order.customer_phone || "No phone"}</p>
        <p className="mt-1 text-slate-700">{postalCode || "No postal code"}</p>
        <p className="mt-1 text-slate-700">{[country, province].filter(Boolean).join(" / ") || "No location"}</p>
      </div>
    </div>
  );
}

function EditableCell({
  field,
  label,
  multiline = false,
  onSave,
  order
}: {
  field: EditableOrderField;
  label: string;
  multiline?: boolean;
  onSave: (id: string, field: EditableOrderField, value: string) => Promise<void>;
  order: ShopifyOrder;
}) {
  const [value, setValue] = useState(String(order[field] || ""));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    const current = String(order[field] || "");

    if (value.trim() === current.trim()) {
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      await onSave(order.id, field, value);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const className = [
    "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none",
    multiline ? "min-w-80" : "min-w-44",
    failed ? "border-red-300" : "border-line",
    saving ? "opacity-60" : ""
  ].join(" ");

  if (multiline) {
    return (
      <textarea
        aria-label={label}
        className={`${className} min-h-24 resize-y`}
        onBlur={save}
        onChange={(event) => setValue(event.target.value)}
        placeholder={label}
        value={value}
      />
    );
  }

  return (
    <input
      aria-label={label}
      className={className}
      onBlur={save}
      onChange={(event) => setValue(event.target.value)}
      placeholder={label}
      value={value}
    />
  );
}

export function OrdersTable({ orders }: { orders: ShopifyOrder[] }) {
  const [rows, setRows] = useState(orders);
  const [query, setQuery] = useState("");
  const [logisticsStatus, setLogisticsStatus] = useState("");
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(rows.map((order) => monthKey(order.created_at))));
    return keys.sort((left, right) => right.localeCompare(left));
  }, [rows]);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0] || "all");

  const logisticsOptions = Array.from(
    new Set(rows.map((order) => order.logistics_status).filter((value): value is string => Boolean(value)))
  ).sort();
  async function saveOrderField(id: string, field: EditableOrderField, value: string) {
    const response = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ [field]: value })
    });

    const payload = (await response.json().catch(() => null)) as ShopifyOrder | null;

    if (!response.ok || !payload) {
      throw new Error("Unable to save order");
    }

    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...payload } : row))
    );
  }

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          order.order_number,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.delegate_order_id,
          order.postal_code,
          order.carrier,
          addressPart(order, "country"),
          addressPart(order, "province"),
          addressPart(order, "province_code")
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesLogistics =
        !logisticsStatus || order.logistics_status === logisticsStatus;
      const matchesMonth = selectedMonth === "all" || monthKey(order.created_at) === selectedMonth;

      return matchesQuery && matchesLogistics && matchesMonth;
    });
  }, [rows, query, logisticsStatus, selectedMonth]);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {monthOptions.map((month) => (
            <button
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
                selectedMonth === month
                  ? "border-blue-200 bg-blue-50 text-slate-900"
                  : "border-line bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              key={month}
              onClick={() => setSelectedMonth(month)}
              type="button"
            >
              {monthLabel(month)}
            </button>
          ))}
          <button
            className={[
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
              selectedMonth === "all"
                ? "border-blue-200 bg-blue-50 text-slate-900"
                : "border-line bg-white text-slate-600 hover:bg-slate-50"
            ].join(" ")}
            onClick={() => setSelectedMonth("all")}
            type="button"
          >
            All
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
          <label className="text-sm font-medium text-slate-700">
            Search
            <input
              className="mt-2 w-full rounded-md border border-line bg-white px-4 py-3 text-base font-normal outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Order, customer, email, phone, Delegate ID, carrier"
              value={query}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Logistics
            <select
              className="mt-2 w-full rounded-md border border-line bg-white px-4 py-3 text-base font-normal outline-none"
              onChange={(event) => setLogisticsStatus(event.target.value)}
              value={logisticsStatus}
            >
              <option value="">All</option>
              {logisticsOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
        <table className="min-w-[1680px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              {[
                "Order",
                "Date",
                "Delegate Order ID",
                "Customer",
                "Carrier",
                "Order created",
                "Delivered date",
                "Delivery status",
                "Fabric",
                "Corner",
                "Armless",
                "Ottoman",
                "Modules",
                "Logistics",
                "Note"
              ].map((heading) => (
                <th className="border-b border-line px-3 py-3 font-semibold" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              return (
                <tr className="border-b border-line align-top last:border-0" key={order.id}>
                  <td className="px-4 py-4 font-semibold">{order.order_number}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="delegate_order_id"
                      label="Delegate ID"
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <CustomerCell order={order} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell field="carrier" label="Carrier" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="delegate_order_created_at"
                      label="Order created date"
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="delivered_at"
                      label="Delivered date"
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="delivery_status"
                      label="Delivery status"
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                  <td className="px-4 py-4">{order.fabric_slug}</td>
                  <td className="px-4 py-4">{order.corner_qty ?? 0}</td>
                  <td className="px-4 py-4">{order.armless_qty ?? 0}</td>
                  <td className="px-4 py-4">{order.ottoman_qty ?? 0}</td>
                  <td className="px-4 py-4 font-semibold">{order.total_modules ?? 0}</td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="logistics_status"
                      label="Logistics status"
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      field="internal_notes"
                      label="Note"
                      multiline
                      onSave={saveOrderField}
                      order={order}
                    />
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={15}>
                  No orders match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
