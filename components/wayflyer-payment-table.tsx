"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { WayflyerPayment, WayflyerPaymentStatus } from "@/lib/types";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export function WayflyerPaymentTable({
  canEdit,
  payments
}: {
  canEdit: boolean;
  payments: WayflyerPayment[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("Weekly Wayflyer payback");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [dueDate, setDueDate] = useState("");
  const [weeks, setWeeks] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("new");
    setMessage(null);

    const response = await fetch("/api/wayflyer-payments", {
      body: JSON.stringify({
        amount,
        currency,
        due_date: dueDate || null,
        label,
        notes,
        weeks
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not save Wayflyer payment.");
      setSavingId(null);
      return;
    }

    setLabel("Weekly Wayflyer payback");
    setAmount("");
    setCurrency("CAD");
    setDueDate("");
    setWeeks("");
    setNotes("");
    setSavingId(null);
    setMessage("Wayflyer schedule saved.");
    router.refresh();
  }

  async function updateStatus(id: string, status: WayflyerPaymentStatus) {
    setSavingId(id);
    setMessage(null);

    const response = await fetch(`/api/wayflyer-payments/${id}`, {
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not update Wayflyer payment.");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setMessage("Wayflyer payment updated.");
    router.refresh();
  }

  async function removePayment(id: string) {
    setSavingId(id);
    setMessage(null);

    const response = await fetch(`/api/wayflyer-payments/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not remove Wayflyer payment.");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setMessage("Wayflyer payment removed.");
    router.refresh();
  }

  const scheduledTotals = payments
    .filter((payment) => payment.status === "scheduled")
    .reduce<Record<string, number>>((totals, payment) => {
      const paymentCurrency = (payment.currency || "CAD").toUpperCase();
      totals[paymentCurrency] = (totals[paymentCurrency] || 0) + Number(payment.amount || 0);
      return totals;
    }, {});
  const nextPayment = payments.find((payment) => payment.status === "scheduled");

  return (
    <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal text-slate-950">Wayflyer financing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the schedule once. The app creates each weekly payback and Demand subtracts it on the due date.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Scheduled total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {Object.keys(scheduledTotals).length === 0
                ? formatMoney(0, "CAD")
                : Object.entries(scheduledTotals).map(([totalCurrency, total]) => formatMoney(total, totalCurrency)).join(" / ")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Next payback</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {nextPayment ? formatDate(nextPayment.due_date) : "None"}
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {message}
        </div>
      ) : null}

      {canEdit ? (
        <form className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.55fr_0.8fr_0.6fr_1.2fr_auto]" onSubmit={createPayment}>
          <input
            className={inputClass}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Payment label"
            required
            value={label}
          />
          <input
            className={inputClass}
            min={0}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Weekly amount"
            required
            step="0.01"
            type="number"
            value={amount}
          />
          <select
            className={inputClass}
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
          <input
            className={inputClass}
            onChange={(event) => setDueDate(event.target.value)}
            required
            type="date"
            value={dueDate}
          />
          <input
            className={inputClass}
            min={1}
            onChange={(event) => setWeeks(event.target.value)}
            placeholder="Weeks"
            required
            type="number"
            value={weeks}
          />
          <input
            className={inputClass}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            value={notes}
          />
          <button
            className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={savingId === "new"}
            type="submit"
          >
            {savingId === "new" ? "Saving..." : "Create schedule"}
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {payments.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No Wayflyer payback schedule entered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Week</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Currency</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  {canEdit ? <th className="px-4 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr className="border-t border-slate-100 align-top" key={payment.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{payment.label}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">
                      {formatMoney(payment.amount, payment.currency || "CAD")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{payment.currency || "CAD"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(payment.due_date)}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        payment.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : payment.status === "cancelled"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-blue-50 text-blue-700"
                      ].join(" ")}>
                        {payment.status || "scheduled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{payment.notes || ""}</td>
                    {canEdit ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {payment.status !== "paid" ? (
                            <button
                              className="h-10 rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={savingId === payment.id}
                              onClick={() => {
                                void updateStatus(payment.id, "paid");
                              }}
                              type="button"
                            >
                              Paid
                            </button>
                          ) : null}
                          <button
                            className="h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={savingId === payment.id}
                            onClick={() => {
                              void removePayment(payment.id);
                            }}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
