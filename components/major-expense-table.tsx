"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { MajorExpense } from "@/lib/types";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export function MajorExpenseTable({
  canEdit,
  expenses
}: {
  canEdit: boolean;
  expenses: MajorExpense[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("new");
    setMessage(null);

    const response = await fetch("/api/major-expenses", {
      body: JSON.stringify({
        amount,
        due_date: dueDate || null,
        label,
        notes
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not save invoice.");
      setSavingId(null);
      return;
    }

    setLabel("");
    setAmount("");
    setDueDate("");
    setNotes("");
    setSavingId(null);
    setMessage("Invoice saved.");
    router.refresh();
  }

  async function removeExpense(id: string) {
    setSavingId(id);
    setMessage(null);

    const response = await fetch(`/api/major-expenses/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not remove invoice.");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setMessage("Invoice removed.");
    router.refresh();
  }

  const openTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return (
    <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal text-slate-950">Other major invoices</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add bills outside containers so Demand can calculate cashflow properly.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Open invoice total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{formatMoney(openTotal, "CAD")}</p>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {message}
        </div>
      ) : null}

      {canEdit ? (
        <form className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr_auto]" onSubmit={createExpense}>
          <input
            className={inputClass}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Invoice name"
            required
            value={label}
          />
          <input
            className={inputClass}
            min={0}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount"
            required
            step="0.01"
            type="number"
            value={amount}
          />
          <input
            className={inputClass}
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
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
            {savingId === "new" ? "Saving..." : "Add invoice"}
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {expenses.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No open major invoices entered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  {canEdit ? <th className="px-4 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr className="border-t border-slate-100 align-top" key={expense.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{expense.label}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">
                      {formatMoney(expense.amount, "CAD")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(expense.due_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.notes || ""}</td>
                    {canEdit ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          className="h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === expense.id}
                          onClick={() => {
                            void removeExpense(expense.id);
                          }}
                          type="button"
                        >
                          {savingId === expense.id ? "Removing..." : "Remove"}
                        </button>
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
