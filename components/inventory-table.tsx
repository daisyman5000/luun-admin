"use client";

import { useMemo, useState } from "react";
import type { InventoryRow } from "@/lib/types";

type EditableField = "available_qty";

export function InventoryTable({
  initialRows,
  canEdit
}: {
  initialRows: InventoryRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        `${a.fabric_slug || ""}:${a.module_slug || ""}`.localeCompare(
          `${b.fabric_slug || ""}:${b.module_slug || ""}`
        )
      ),
    [rows]
  );

  function updateLocalRow(id: string, field: EditableField, value: number) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  async function saveRow(row: InventoryRow) {
    setSavingId(row.id);
    setMessage(null);

    const response = await fetch(`/api/inventory/${row.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        available_qty: Number(row.available_qty || 0)
      })
    });

    setSavingId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error || "Unable to save inventory.");
      return;
    }

    const data = (await response.json()) as InventoryRow;
    setRows((currentRows) =>
      currentRows.map((currentRow) => (currentRow.id === row.id ? data : currentRow))
    );
    setMessage("Inventory saved.");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {canEdit ? "Available quantity saves per row." : "Your role can view inventory only."}
        </p>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
        <table className="min-w-[560px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              {["Fabric", "Module", "Available", ""].map((heading) => (
                <th className="border-b border-line px-3 py-3 font-semibold" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr className="border-b border-line last:border-0" key={row.id}>
                <td className="px-4 py-4 font-semibold">{row.fabric_slug}</td>
                <td className="px-4 py-4">{row.module_slug}</td>
                <td className="px-4 py-3">
                  <input
                    aria-label={`${row.fabric_slug} ${row.module_slug} available quantity`}
                    className="w-32 rounded-md border border-line bg-white px-4 py-3 text-base disabled:border-line disabled:bg-slate-50"
                    disabled={!canEdit}
                    min={0}
                    onChange={(event) =>
                      updateLocalRow(row.id, "available_qty", Number(event.target.value))
                    }
                    type="number"
                    value={row.available_qty ?? 0}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit ? (
                    <button
                      className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={savingId === row.id}
                      onClick={() => saveRow(row)}
                      type="button"
                    >
                      {savingId === row.id ? "Saving" : "Save"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={4}>
                  No inventory rows yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
