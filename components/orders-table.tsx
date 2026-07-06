"use client";

import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { ShopifyOrder } from "@/lib/types";

type EditableOrderField =
  | "delegate_order_id"
  | "postal_code"
  | "carrier"
  | "delegate_order_created_at"
  | "delivered_at"
  | "delivery_status"
  | "logistics_status"
  | "internal_notes"
  | "action_needed";

function addressPart(order: ShopifyOrder, key: "country" | "province" | "province_code" | "zip") {
  const address = order.shipping_address_json;
  const value = address?.[key];
  return typeof value === "string" ? value : "";
}

function EditableCell({
  field,
  multiline = false,
  onSave,
  order
}: {
  field: EditableOrderField;
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
    "w-full min-w-28 rounded border bg-white px-2 py-1 text-sm outline-none focus:border-slate-500",
    failed ? "border-red-300" : "border-transparent hover:border-line",
    saving ? "opacity-60" : ""
  ].join(" ");

  if (multiline) {
    return (
      <textarea
        className={`${className} min-h-16 min-w-72 resize-y`}
        onBlur={save}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
    );
  }

  return (
    <input
      className={className}
      onBlur={save}
      onChange={(event) => setValue(event.target.value)}
      value={value}
    />
  );
}

export function OrdersTable({ orders }: { orders: ShopifyOrder[] }) {
  const [rows, setRows] = useState(orders);
  const [query, setQuery] = useState("");
  const [logisticsStatus, setLogisticsStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");

  const logisticsOptions = Array.from(
    new Set(rows.map((order) => order.logistics_status).filter((value): value is string => Boolean(value)))
  ).sort();
  const fulfillmentOptions = Array.from(
    new Set(rows.map((order) => order.fulfillment_status).filter((value): value is string => Boolean(value)))
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
          order.delegate_order_id,
          order.postal_code,
          order.carrier
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesLogistics =
        !logisticsStatus || order.logistics_status === logisticsStatus;
      const matchesFulfillment =
        !fulfillmentStatus || order.fulfillment_status === fulfillmentStatus;

      return matchesQuery && matchesLogistics && matchesFulfillment;
    });
  }, [rows, query, logisticsStatus, fulfillmentStatus]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">
          Search
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-normal outline-none focus:border-slate-500"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order, customer, email, Delegate ID, carrier"
            value={query}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Logistics
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-normal outline-none focus:border-slate-500 md:w-48"
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
        <label className="text-sm font-medium text-slate-700">
          Fulfillment
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-normal outline-none focus:border-slate-500 md:w-48"
            onChange={(event) => setFulfillmentStatus(event.target.value)}
            value={fulfillmentStatus}
          >
            <option value="">All</option>
            {fulfillmentOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="min-w-[2300px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              {[
                "Order",
                "Date",
                "Delegate Order ID",
                "Customer",
                "Email",
                "Phone",
                "Postal code",
                "Country / province",
                "Carrier",
                "Order created",
                "Delivered date",
                "Delivery status",
                "Fabric",
                "Corner",
                "Armless",
                "Ottoman",
                "Modules",
                "Total paid",
                "Payment",
                "Fulfillment",
                "Logistics",
                "Note",
                "Action needed"
              ].map((heading) => (
                <th className="border-b border-line px-3 py-3 font-semibold" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const province = addressPart(order, "province") || addressPart(order, "province_code");
              const country = addressPart(order, "country");
              const postalCode = order.postal_code || addressPart(order, "zip");

              return (
                <tr className="border-b border-line align-top last:border-0" key={order.id}>
                  <td className="px-3 py-3 font-medium">{order.order_number}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(order.created_at)}</td>
                  <td className="px-3 py-2">
                    <EditableCell field="delegate_order_id" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-3">{order.customer_name}</td>
                  <td className="px-3 py-3 text-slate-600">{order.customer_email}</td>
                  <td className="px-3 py-3 text-slate-600">{order.customer_phone}</td>
                  <td className="px-3 py-2">
                    <EditableCell
                      field="postal_code"
                      onSave={saveOrderField}
                      order={{ ...order, postal_code: postalCode }}
                    />
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {[country, province].filter(Boolean).join(" / ")}
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="carrier" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="delegate_order_created_at" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="delivered_at" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="delivery_status" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-3">{order.fabric_slug}</td>
                  <td className="px-3 py-3">{order.corner_qty ?? 0}</td>
                  <td className="px-3 py-3">{order.armless_qty ?? 0}</td>
                  <td className="px-3 py-3">{order.ottoman_qty ?? 0}</td>
                  <td className="px-3 py-3 font-medium">{order.total_modules ?? 0}</td>
                  <td className="px-3 py-3">
                    {formatMoney(order.total_price, order.currency || "USD")}
                  </td>
                  <td className="px-3 py-3">{order.payment_status}</td>
                  <td className="px-3 py-3">{order.fulfillment_status}</td>
                  <td className="px-3 py-2">
                    <EditableCell field="logistics_status" onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="internal_notes" multiline onSave={saveOrderField} order={order} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell field="action_needed" multiline onSave={saveOrderField} order={order} />
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={23}>
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
