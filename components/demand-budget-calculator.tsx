"use client";

import { useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function DemandBudgetCalculator({
  baselineOrders,
  customerAcquisitionCost
}: {
  baselineOrders: number | null;
  customerAcquisitionCost: number | null;
}) {
  const [orders, setOrders] = useState(String(baselineOrders || 50));
  const orderCount = Math.max(0, Number(orders) || 0);
  const budget = customerAcquisitionCost === null ? null : orderCount * customerAcquisitionCost;

  return (
    <section className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Meta budget</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            {budget === null ? "Unavailable" : money(budget)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Budget uses live CAC from Wise Meta spend divided by Shopify orders.
          </p>
        </div>
        <label className="min-w-64 text-sm font-medium text-slate-700">
          Orders to sell this month
          <input
            className="mt-2 w-full rounded-lg px-4 py-3 text-lg font-semibold"
            inputMode="numeric"
            min="0"
            onChange={(event) => setOrders(event.target.value)}
            type="number"
            value={orders}
          />
        </label>
      </div>
      <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-600">
        {customerAcquisitionCost === null
          ? "CAC is unavailable until both Wise Meta spend and Shopify orders exist in the app."
          : `${orderCount} orders x ${money(customerAcquisitionCost)} CAC`}
      </div>
    </section>
  );
}
