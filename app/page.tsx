import { requireUser } from "@/lib/auth";
import type { InventoryRow } from "@/lib/types";

type ModuleTotals = {
  armless: number;
  corner: number;
  ottoman: number;
};

type FabricInventory = {
  fabric: string;
  modules: ModuleTotals;
  total: number;
};

const modules: (keyof ModuleTotals)[] = ["corner", "armless", "ottoman"];

function titleCase(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyTotals(): ModuleTotals {
  return {
    armless: 0,
    corner: 0,
    ottoman: 0
  };
}

function summarizeVancouverInventory(rows: InventoryRow[]): FabricInventory[] {
  const byFabric = new Map<string, ModuleTotals>();

  for (const row of rows) {
    const fabric = row.fabric_slug || "unknown";
    const moduleName = row.module_slug;

    if (!moduleName || !modules.includes(moduleName as keyof ModuleTotals)) {
      continue;
    }

    const totals = byFabric.get(fabric) || emptyTotals();
    totals[moduleName as keyof ModuleTotals] += Number(row.available_qty || 0);
    byFabric.set(fabric, totals);
  }

  return Array.from(byFabric.entries())
    .map(([fabric, totals]) => ({
      fabric,
      modules: totals,
      total: modules.reduce((sum, module) => sum + totals[module], 0)
    }))
    .sort((left, right) => left.fabric.localeCompare(right.fabric));
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function InventoryTable({ rows }: { rows: FabricInventory[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-slate-600">
        No Vancouver on-hand inventory rows are available yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Fabric</th>
            <th className="px-4 py-3 text-right">Corner</th>
            <th className="px-4 py-3 text-right">Armless</th>
            <th className="px-4 py-3 text-right">Ottoman</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line" key={row.fabric}>
              <td className="px-4 py-4 font-semibold text-slate-950">{titleCase(row.fabric)}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.corner}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.armless}</td>
              <td className="px-4 py-4 text-right font-medium text-slate-800">{row.modules.ottoman}</td>
              <td className="px-4 py-4 text-right text-lg font-semibold text-slate-950">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleMix({ rows }: { rows: FabricInventory[] }) {
  const totals = rows.reduce<ModuleTotals>((summary, row) => {
    for (const moduleName of modules) {
      summary[moduleName] += row.modules[moduleName];
    }
    return summary;
  }, emptyTotals());
  const max = Math.max(...modules.map((module) => totals[module]), 1);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">Module mix</h2>
        <p className="mt-1 text-sm text-slate-500">Actual pieces on hand in Vancouver.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {modules.map((module) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={module}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold capitalize text-slate-800">{module}</span>
              <span className="text-2xl font-semibold text-slate-950">{totals[module]}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.max(8, (totals[module] / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("fabric_slug", { ascending: true })
    .order("module_slug", { ascending: true })
    .returns<InventoryRow[]>();

  const inventoryRows = summarizeVancouverInventory(data || []);
  const totalPieces = inventoryRows.reduce((sum, row) => sum + row.total, 0);

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Luun Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Vancouver inventory</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Real on-hand inventory only. Forecasting, planned sales, fake purchase orders, and fake incoming containers are not shown here.
        </p>
      </div>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Unable to load Vancouver inventory.
        </section>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total on hand" value={totalPieces} />
            <StatCard label="Fabrics" value={inventoryRows.length} />
            <StatCard
              label="Corner pieces"
              value={inventoryRows.reduce((sum, row) => sum + row.modules.corner, 0)}
            />
            <StatCard
              label="Armless pieces"
              value={inventoryRows.reduce((sum, row) => sum + row.modules.armless, 0)}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <div>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-950">Inventory by fabric</h2>
                <p className="mt-1 text-sm text-slate-500">Available quantity from the Inventory table.</p>
              </div>
              <InventoryTable rows={inventoryRows} />
            </div>
            <ModuleMix rows={inventoryRows} />
          </section>
        </div>
      )}
    </main>
  );
}
