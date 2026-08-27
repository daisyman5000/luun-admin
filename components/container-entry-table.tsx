"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { ContainerEntry, ContainerEntryStatus } from "@/lib/types";

const statuses: { label: string; value: ContainerEntryStatus }[] = [
  { label: "Planning", value: "planning" },
  { label: "Production", value: "production" },
  { label: "In transit", value: "in_transit" },
  { label: "Arrived", value: "arrived" },
  { label: "Closed", value: "closed" }
];

type DraftContainer = {
  amount_paid: string;
  amount_to_be_paid: string;
  container_number: string;
  eta: string;
  notes: string;
  payment_due_at: string;
  purchase_order_id: string;
  skus_on_board: string;
  status: ContainerEntryStatus;
};

const emptyDraft: DraftContainer = {
  amount_paid: "",
  amount_to_be_paid: "",
  container_number: "",
  eta: "",
  notes: "",
  payment_due_at: "",
  purchase_order_id: "",
  skus_on_board: "",
  status: "planning"
};

function toInputDate(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toDraft(container: ContainerEntry): DraftContainer {
  return {
    amount_paid: String(container.amount_paid ?? 0),
    amount_to_be_paid: String(container.amount_to_be_paid ?? 0),
    container_number: container.container_number,
    eta: toInputDate(container.eta),
    notes: container.notes || "",
    payment_due_at: toInputDate(container.payment_due_at),
    purchase_order_id: container.purchase_order_id || "",
    skus_on_board: container.skus_on_board || "",
    status: container.status || "planning"
  };
}

function payloadFromDraft(draft: DraftContainer) {
  return {
    amount_paid: Number(draft.amount_paid || 0),
    amount_to_be_paid: Number(draft.amount_to_be_paid || 0),
    container_number: draft.container_number,
    eta: draft.eta || null,
    notes: draft.notes,
    payment_due_at: draft.payment_due_at || null,
    purchase_order_id: draft.purchase_order_id,
    skus_on_board: draft.skus_on_board,
    status: draft.status
  };
}

function statusLabel(status?: string | null) {
  return statuses.find((item) => item.value === status)?.label || "Planning";
}

function Field({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const textareaClass =
  "mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export function ContainerEntryTable({
  canEdit,
  containers
}: {
  canEdit: boolean;
  containers: ContainerEntry[];
}) {
  const router = useRouter();
  const [createDraft, setCreateDraft] = useState(emptyDraft);
  const [drafts, setDrafts] = useState<Record<string, DraftContainer>>(
    Object.fromEntries(containers.map((container) => [container.id, toDraft(container)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateDraft(id: string, field: keyof DraftContainer, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value
      }
    }));
  }

  async function createContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("new");
    setMessage(null);

    const response = await fetch("/api/containers", {
      body: JSON.stringify(payloadFromDraft(createDraft)),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not save container.");
      setSavingId(null);
      return;
    }

    setCreateDraft(emptyDraft);
    setSavingId(null);
    setMessage("Container saved.");
    router.refresh();
  }

  async function saveContainer(id: string) {
    const draft = drafts[id];
    setSavingId(id);
    setMessage(null);

    const response = await fetch(`/api/containers/${id}`, {
      body: JSON.stringify(payloadFromDraft(draft)),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "Could not update container.");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setMessage("Container updated.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {message}
        </div>
      ) : null}

      {canEdit ? (
        <form className="rounded-[28px] border border-white bg-white/90 p-5 shadow-sm" onSubmit={createContainer}>
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-normal text-slate-950">Enter container</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add what is on board, what has been paid, what is still due, and when it arrives.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            <Field label="Container">
              <input
                className={inputClass}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, container_number: event.target.value }))}
                placeholder="CONT-LUUN-0901"
                required
                value={createDraft.container_number}
              />
            </Field>
            <Field label="Purchase order">
              <input
                className={inputClass}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, purchase_order_id: event.target.value }))}
                placeholder="PO-2609A"
                value={createDraft.purchase_order_id}
              />
            </Field>
            <Field label="ETA">
              <input
                className={inputClass}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, eta: event.target.value }))}
                type="date"
                value={createDraft.eta}
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                onChange={(event) =>
                  setCreateDraft((draft) => ({ ...draft, status: event.target.value as ContainerEntryStatus }))
                }
                value={createDraft.status}
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount paid">
              <input
                className={inputClass}
                min={0}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, amount_paid: event.target.value }))}
                placeholder="0"
                step="0.01"
                type="number"
                value={createDraft.amount_paid}
              />
            </Field>
            <Field label="Amount to be paid">
              <input
                className={inputClass}
                min={0}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, amount_to_be_paid: event.target.value }))}
                placeholder="0"
                step="0.01"
                type="number"
                value={createDraft.amount_to_be_paid}
              />
            </Field>
            <Field label="Payment due">
              <input
                className={inputClass}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, payment_due_at: event.target.value }))}
                type="date"
                value={createDraft.payment_due_at}
              />
            </Field>
            <div className="flex items-end">
              <button
                className="h-12 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={savingId === "new"}
                type="submit"
              >
                {savingId === "new" ? "Saving..." : "Save container"}
              </button>
            </div>
            <div className="lg:col-span-2">
              <Field label="SKUs on board">
                <textarea
                  className={textareaClass}
                  onChange={(event) => setCreateDraft((draft) => ({ ...draft, skus_on_board: event.target.value }))}
                  placeholder="LCC-COR-WHITE x 34&#10;LCC-SIDE-WHITE x 30"
                  value={createDraft.skus_on_board}
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="Notes">
                <textarea
                  className={textareaClass}
                  onChange={(event) => setCreateDraft((draft) => ({ ...draft, notes: event.target.value }))}
                  placeholder="Factory update, payment note, packing note..."
                  value={createDraft.notes}
                />
              </Field>
            </div>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-white bg-white/90 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-xl font-semibold tracking-normal text-slate-950">Containers</h2>
          <p className="mt-1 text-sm text-slate-500">{containers.length} container entries</p>
        </div>
        {containers.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No containers entered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Container</th>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">SKUs on board</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">To be paid</th>
                  <th className="px-4 py-3 text-left">Payment due</th>
                  <th className="px-4 py-3 text-left">ETA</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {canEdit ? <th className="px-4 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => {
                  const draft = drafts[container.id] || toDraft(container);

                  return (
                    <tr className="border-t border-slate-100 align-top" key={container.id}>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <input
                            className={inputClass}
                            onChange={(event) => updateDraft(container.id, "container_number", event.target.value)}
                            value={draft.container_number}
                          />
                        ) : (
                          <span className="font-semibold">{container.container_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <input
                            className={inputClass}
                            onChange={(event) => updateDraft(container.id, "purchase_order_id", event.target.value)}
                            value={draft.purchase_order_id}
                          />
                        ) : (
                          container.purchase_order_id || ""
                        )}
                      </td>
                      <td className="w-[280px] px-4 py-3">
                        {canEdit ? (
                          <textarea
                            className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                            onChange={(event) => updateDraft(container.id, "skus_on_board", event.target.value)}
                            value={draft.skus_on_board}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{container.skus_on_board}</pre>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            className={`${inputClass} text-right`}
                            min={0}
                            onChange={(event) => updateDraft(container.id, "amount_paid", event.target.value)}
                            step="0.01"
                            type="number"
                            value={draft.amount_paid}
                          />
                        ) : (
                          formatMoney(container.amount_paid, "CAD")
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            className={`${inputClass} text-right`}
                            min={0}
                            onChange={(event) => updateDraft(container.id, "amount_to_be_paid", event.target.value)}
                            step="0.01"
                            type="number"
                            value={draft.amount_to_be_paid}
                          />
                        ) : (
                          formatMoney(container.amount_to_be_paid, "CAD")
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <input
                            className={inputClass}
                            onChange={(event) => updateDraft(container.id, "payment_due_at", event.target.value)}
                            type="date"
                            value={draft.payment_due_at}
                          />
                        ) : (
                          formatDate(container.payment_due_at)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <input
                            className={inputClass}
                            onChange={(event) => updateDraft(container.id, "eta", event.target.value)}
                            type="date"
                            value={draft.eta}
                          />
                        ) : (
                          formatDate(container.eta)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <select
                            className={inputClass}
                            onChange={(event) => updateDraft(container.id, "status", event.target.value)}
                            value={draft.status}
                          >
                            {statuses.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          statusLabel(container.status)
                        )}
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={savingId === container.id}
                            onClick={() => saveContainer(container.id)}
                            type="button"
                          >
                            {savingId === container.id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
