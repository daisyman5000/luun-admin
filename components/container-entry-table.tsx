"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { ContainerEntry, ContainerManifestItem } from "@/lib/types";

const manifestColors = ["White", "Dark grey", "Peach", "Aqua", "Jade", "Slipcover design"] as const;
const manifestModules = ["corner", "armless", "ottoman"] as const;

type ManifestColor = (typeof manifestColors)[number];
type ManifestModule = (typeof manifestModules)[number];
type ManifestDraft = Record<ManifestColor, Record<ManifestModule, string>>;

type DraftContainer = {
  amount_paid: string;
  amount_to_be_paid: string;
  container_number: string;
  eta: string;
  manifest: ManifestDraft;
  notes: string;
  payment_due_at: string;
};

type DraftTextField = Exclude<keyof DraftContainer, "manifest">;

function emptyManifest(): ManifestDraft {
  return Object.fromEntries(
    manifestColors.map((color) => [
      color,
      Object.fromEntries(manifestModules.map((moduleName) => [moduleName, ""])) as Record<ManifestModule, string>
    ])
  ) as ManifestDraft;
}

function emptyDraft(): DraftContainer {
  return {
    amount_paid: "",
    amount_to_be_paid: "",
    container_number: "",
    eta: "",
    manifest: emptyManifest(),
    notes: "",
    payment_due_at: ""
  };
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function manifestItemsFromText(value?: string | null): ContainerManifestItem[] {
  if (!value) return [];

  const items: ContainerManifestItem[] = [];

  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.+?)\s+x\s+(\d+)$/i);
      if (!match) return;
      const sku = match[1].trim().toUpperCase();
      const quantity = Number(match[2]);
      const color =
        manifestColors.find((item) => sku.includes(item.toUpperCase().replace(/\s/g, ""))) ||
        manifestColors.find((item) => sku.includes(item.toUpperCase().replace("DARK GREY", "GREY")));
      const moduleName = manifestModules.find((item) => sku.includes(item === "ottoman" ? "OTT" : item === "corner" ? "COR" : "SIDE"));

      if (!color || !moduleName || !Number.isInteger(quantity)) return;
      items.push({ color, module: moduleName, quantity });
    });

  return items;
}

function manifestToDraft(items?: ContainerManifestItem[] | null, textFallback?: string | null) {
  const draft = emptyManifest();
  const sourceItems = items && items.length > 0 ? items : manifestItemsFromText(textFallback);

  for (const item of sourceItems) {
    if (
      manifestColors.includes(item.color as ManifestColor) &&
      manifestModules.includes(item.module as ManifestModule) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    ) {
      draft[item.color as ManifestColor][item.module as ManifestModule] = String(item.quantity);
    }
  }

  return draft;
}

function manifestFromDraft(manifest: ManifestDraft): ContainerManifestItem[] {
  return manifestColors.flatMap((color) =>
    manifestModules
      .map((moduleName) => ({
        color,
        module: moduleName,
        quantity: Number(manifest[color][moduleName] || 0)
      }))
      .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0)
  );
}

function manifestText(items: ContainerManifestItem[]) {
  return items.map((item) => `${item.color} ${item.module} x ${item.quantity}`).join("\n");
}

function manifestTotal(items: ContainerManifestItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function toDraft(container: ContainerEntry): DraftContainer {
  return {
    amount_paid: String(container.amount_paid ?? 0),
    amount_to_be_paid: String(container.amount_to_be_paid ?? 0),
    container_number: container.container_number,
    eta: toInputDate(container.eta),
    manifest: manifestToDraft(container.manifest_json, container.skus_on_board),
    notes: container.notes || "",
    payment_due_at: toInputDate(container.payment_due_at)
  };
}

function payloadFromDraft(draft: DraftContainer) {
  const manifest = manifestFromDraft(draft.manifest);

  return {
    amount_paid: Number(draft.amount_paid || 0),
    amount_to_be_paid: Number(draft.amount_to_be_paid || 0),
    amount_currency: "USD",
    container_number: draft.container_number,
    eta: draft.eta || null,
    manifest_json: manifest,
    notes: draft.notes,
    payment_due_at: draft.payment_due_at || null,
    skus_on_board: manifestText(manifest),
    status: "planning"
  };
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

function ManifestGrid({
  manifest,
  onChange,
  readOnly = false
}: {
  manifest: ManifestDraft;
  onChange?: (color: ManifestColor, moduleName: ManifestModule, value: string) => void;
  readOnly?: boolean;
}) {
  const items = manifestFromDraft(manifest);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[1.1fr_repeat(3,minmax(80px,0.7fr))] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <div>Colour</div>
        <div className="text-right">Corner</div>
        <div className="text-right">Armless</div>
        <div className="text-right">Ottoman</div>
      </div>
      <div className="divide-y divide-slate-100">
        {manifestColors.map((color) => (
          <div className="grid grid-cols-[1.1fr_repeat(3,minmax(80px,0.7fr))] items-center gap-2 px-3 py-3" key={color}>
            <div className="font-semibold text-slate-900">{color}</div>
            {manifestModules.map((moduleName) => (
              <div key={`${color}-${moduleName}`}>
                {readOnly ? (
                  <div className="text-right text-base font-semibold text-slate-900">
                    {manifest[color][moduleName] || "0"}
                  </div>
                ) : (
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-right text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    min={0}
                    onChange={(event) => onChange?.(color, moduleName, event.target.value)}
                    placeholder="0"
                    type="number"
                    value={manifest[color][moduleName]}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-3 text-sm">
        <span className="font-medium text-slate-500">Manifest total</span>
        <span className="text-lg font-semibold text-slate-950">{manifestTotal(items)}</span>
      </div>
    </div>
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
  const [createDraft, setCreateDraft] = useState(emptyDraft());
  const [drafts, setDrafts] = useState<Record<string, DraftContainer>>(
    Object.fromEntries(containers.map((container) => [container.id, toDraft(container)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateDraft(id: string, field: DraftTextField, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value
      }
    }));
  }

  function updateManifestDraft(id: string, color: ManifestColor, moduleName: ManifestModule, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        manifest: {
          ...current[id].manifest,
          [color]: {
            ...current[id].manifest[color],
            [moduleName]: value
          }
        }
      }
    }));
  }

  function updateCreateManifest(color: ManifestColor, moduleName: ManifestModule, value: string) {
    setCreateDraft((draft) => ({
      ...draft,
      manifest: {
        ...draft.manifest,
        [color]: {
          ...draft.manifest[color],
          [moduleName]: value
        }
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

    setCreateDraft(emptyDraft());
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
            <Field label="ETA">
              <input
                className={inputClass}
                onChange={(event) => setCreateDraft((draft) => ({ ...draft, eta: event.target.value }))}
                type="date"
                value={createDraft.eta}
              />
            </Field>
            <Field label="Amount paid (USD)">
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
            <Field label="Amount to be paid (USD)">
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
            <div className="flex items-end lg:col-span-2">
              <button
                className="h-12 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={savingId === "new"}
                type="submit"
              >
                {savingId === "new" ? "Saving..." : "Save container"}
              </button>
            </div>
            <div className="lg:col-span-4">
              <Field label="Manifest">
                <div className="mt-1">
                  <ManifestGrid manifest={createDraft.manifest} onChange={updateCreateManifest} />
                </div>
              </Field>
            </div>
            <div className="lg:col-span-4">
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
                  <th className="px-4 py-3 text-left">Manifest</th>
                  <th className="px-4 py-3 text-right">Paid USD</th>
                  <th className="px-4 py-3 text-right">To be paid USD</th>
                  <th className="px-4 py-3 text-left">Payment due</th>
                  <th className="px-4 py-3 text-left">ETA</th>
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
                      <td className="w-[420px] px-4 py-3">
                        {canEdit ? (
                          <ManifestGrid
                            manifest={draft.manifest}
                            onChange={(color, moduleName, value) => updateManifestDraft(container.id, color, moduleName, value)}
                          />
                        ) : (
                          <ManifestGrid manifest={draft.manifest} readOnly />
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
                          formatMoney(container.amount_paid, container.amount_currency || "USD")
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
                          formatMoney(container.amount_to_be_paid, container.amount_currency || "USD")
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
