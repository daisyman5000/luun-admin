"use client";

import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { ShopifyOrder } from "@/lib/types";

function addressPart(order: ShopifyOrder, key: "country" | "province" | "province_code") {
  const address = order.shipping_address_json;
  const value = address?.[key];
  return typeof value === "string" ? value : "";
}

export function OrdersTable({ orders }: { orders: ShopifyOrder[] }) {
  const [query, setQuery] = useState("");
  const [logisticsStatus, setLogisticsStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");

  const logisticsOptions = Array.from(
    new Set(orders.map((order) => order.logistics_status).filter((value): value is string => Boolean(value)))
  ).sort();
  const fulfillmentOptions = Array.from(
    new Set(orders.map((order) => order.fulfillment_status).filter((value): value is string => Boolean(value)))
  ).sort();

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        [order.order_number, order.customer_name, order.customer_email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesLogistics =
        !logisticsStatus || order.logistics_status === logisticsStatus;
      const matchesFulfillment =
        !fulfillmentStatus || order.fulfillment_status === fulfillmentStatus;

      return matchesQuery && matchesLogistics && matchesFulfillment;
    });
  }, [orders, query, logisticsStatus, fulfillmentStatus]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">
          Search
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-normal outline-none focus:border-slate-500"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order number, customer, email"
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
        <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              {[
                "Order",
                "Date",
                "Customer",
                "Email",
                "Phone",
                "Country / province",
                "Fabric",
                "Corner",
                "Armless",
                "Ottoman",
                "Modules",
                "Total paid",
                "Payment",
                "Fulfillment",
                "Logistics",
                "Notes"
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
              return (
                <tr className="border-b border-line last:border-0" key={order.id}>
                  <td className="px-3 py-3 font-medium">{order.order_number}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(order.created_at)}</td>
                  <td className="px-3 py-3">{order.customer_name}</td>
                  <td className="px-3 py-3 text-slate-600">{order.customer_email}</td>
                  <td className="px-3 py-3 text-slate-600">{order.customer_phone}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {[country, province].filter(Boolean).join(" / ")}
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
                  <td className="px-3 py-3">{order.logistics_status}</td>
                  <td className="max-w-72 px-3 py-3 text-slate-600">{order.internal_notes}</td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={16}>
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
