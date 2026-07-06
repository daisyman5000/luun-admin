"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { InventoryRow } from "@/lib/types";

type EditableField =
  | "available_qty"
  | "reserved_qty"
  | "incoming_qty"
  | "low_stock_threshold"
  | "builder_visible";

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

  function updateLocalRow(id: string, field: EditableField, value: number | boolean) {
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
        available_qty: Number(row.available_qty || 0),
        reserved_qty: Number(row.reserved_qty || 0),
        incoming_qty: Number(row.incoming_qty || 0),
        low_stock_threshold: Number(row.low_stock_threshold || 0),
        builder_visible: Boolean(row.builder_visible)
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {canEdit ? "Inventory changes save per row." : "Your role can view inventory only."}
        </p>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              {[
                "Fabric",
                "Module",
                "Available",
                "Reserved",
                "Incoming",
                "Low stock",
                "Builder visible",
                "Updated",
                ""
              ].map((heading) => (
                <th className="border-b border-line px-3 py-3 font-semibold" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr className="border-b border-line last:border-0" key={row.id}>
                <td className="px-3 py-3 font-medium">{row.fabric_slug}</td>
                <td className="px-3 py-3">{row.module_slug}</td>
                {(["available_qty", "reserved_qty", "incoming_qty", "low_stock_threshold"] as const).map(
                  (field) => (
                    <td className="px-3 py-3" key={field}>
                      <input
                        className="w-24 rounded-md border border-line bg-white px-2 py-1.5 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                        disabled={!canEdit}
                        min={0}
                        onChange={(event) =>
                          updateLocalRow(row.id, field, Number(event.target.value))
                        }
                        type="number"
                        value={row[field] ?? 0}
                      />
                    </td>
                  )
                )}
                <td className="px-3 py-3">
                  <input
                    checked={Boolean(row.builder_visible)}
                    className="h-4 w-4"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateLocalRow(row.id, "builder_visible", event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(row.updated_at)}</td>
                <td className="px-3 py-3 text-right">
                  {canEdit ? (
                    <button
                      className="rounded-md border border-line px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>
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
