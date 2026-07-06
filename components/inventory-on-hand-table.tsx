import type { InventoryRow } from "@/lib/types";
import { normalizeFabricSlug, normalizeModuleSlug } from "@/lib/inventory-normalize";

const moduleOrder = ["corner", "side", "ottoman"];

function title(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function InventoryOnHandTable({ rows }: { rows: InventoryRow[] }) {
  const grouped = new Map<string, Record<string, number>>();

  rows.forEach((row) => {
    const fabric = normalizeFabricSlug(row.fabric_slug);
    const moduleSlug = normalizeModuleSlug(row.module_slug);

    if (!fabric || !moduleSlug) return;

    const current = grouped.get(fabric) || {};
    current[moduleSlug] = (current[moduleSlug] || 0) + Number(row.available_qty || 0);
    grouped.set(fabric, current);
  });

  const fabrics = Array.from(grouped.keys()).sort();
  const modules = Array.from(
    new Set([
      ...moduleOrder,
      ...Array.from(grouped.values()).flatMap((modulesByFabric) => Object.keys(modulesByFabric))
    ])
  ).sort((left, right) => {
    const leftIndex = moduleOrder.indexOf(left);
    const rightIndex = moduleOrder.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
          <tr>
            <th className="border-b border-line px-3 py-3 font-semibold">Fabric</th>
            {modules.map((moduleSlug) => (
              <th className="border-b border-line px-3 py-3 text-right font-semibold" key={moduleSlug}>
                {title(moduleSlug)}
              </th>
            ))}
            <th className="border-b border-line px-3 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {fabrics.map((fabric) => {
            const modulesByFabric = grouped.get(fabric) || {};
            const total = modules.reduce((sum, moduleSlug) => sum + (modulesByFabric[moduleSlug] || 0), 0);

            return (
              <tr className="border-b border-line last:border-0" key={fabric}>
                <td className="px-3 py-3 font-medium">{fabric}</td>
                {modules.map((moduleSlug) => (
                  <td className="px-3 py-3 text-right" key={moduleSlug}>
                    {modulesByFabric[moduleSlug] || 0}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-semibold">{total}</td>
              </tr>
            );
          })}
          {fabrics.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-slate-500" colSpan={modules.length + 2}>
                No inventory rows yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
