import { requireUser } from "@/lib/auth";
import type { InventoryRow, ShopifyOrder } from "@/lib/types";

type MonthSummary = {
  label: string;
  modules: number;
  orders: number;
  revenue: number;
};

type FabricSummary = {
  fabric: string;
  modules: number;
  orders: number;
};

type InventorySummary = {
  available: number;
  fabric: string;
  modules: {
    armless: number;
    corner: number;
    ottoman: number;
  };
};

type StatusSummary = {
  count: number;
  label: string;
};

const MODULE_ORDER = ["corner", "armless", "ottoman"] as const;

function normalizeLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderModules(order: ShopifyOrder) {
  return Number(order.total_modules ?? 0);
}

function getOrderRevenue(order: ShopifyOrder) {
  return Number(order.total_price ?? 0);
}

function buildMonthlySummary(orders: ShopifyOrder[]) {
  const months = new Map<string, MonthSummary>();

  orders.forEach((order) => {
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const current = months.get(key) ?? { label, modules: 0, orders: 0, revenue: 0 };

    current.orders += 1;
    current.modules += getOrderModules(order);
    current.revenue += getOrderRevenue(order);
    months.set(key, current);
  });

  return Array.from(months.values()).slice(-6);
}

function buildFabricSummary(orders: ShopifyOrder[]) {
  const fabrics = new Map<string, FabricSummary>();

  orders.forEach((order) => {
    const fabric = normalizeLabel(order.fabric_slug);
    const current = fabrics.get(fabric) ?? { fabric, modules: 0, orders: 0 };

    current.orders += 1;
    current.modules += getOrderModules(order);
    fabrics.set(fabric, current);
  });

  return Array.from(fabrics.values())
    .sort((a, b) => b.modules - a.modules)
    .slice(0, 6);
}

function buildInventorySummary(rows: InventoryRow[]) {
  const fabrics = new Map<string, InventorySummary>();

  rows.forEach((row) => {
    const fabric = normalizeLabel(row.fabric_slug);
    const moduleSlug = row.module_slug;
    const available = Math.max(0, Number(row.available_qty ?? 0) - Number(row.reserved_qty ?? 0));
    const current = fabrics.get(fabric) ?? {
      available: 0,
      fabric,
      modules: { armless: 0, corner: 0, ottoman: 0 }
    };

    if (moduleSlug === "corner" || moduleSlug === "armless" || moduleSlug === "ottoman") {
      current.modules[moduleSlug] += available;
    }

    current.available += available;
    fabrics.set(fabric, current);
  });

  return Array.from(fabrics.values()).sort((a, b) => b.available - a.available);
}

function buildStatusSummary(orders: ShopifyOrder[]) {
  const statuses = new Map<string, number>();

  orders.forEach((order) => {
    const label = normalizeLabel(order.logistics_status ?? "new");
    statuses.set(label, (statuses.get(label) ?? 0) + 1);
  });

  return Array.from(statuses.entries())
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count);
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function EmptyGraph({ label }: { label: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-line bg-slate-50 px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function DashboardPanel({
  children,
  subtitle,
  title
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-900">{value}</p>
    </div>
  );
}

function MonthlyGraph({ rows }: { rows: MonthSummary[] }) {
  const maxModules = Math.max(...rows.map((row) => row.modules), 1);

  if (rows.length === 0) return <EmptyGraph label="No order data yet." />;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div className="grid grid-cols-[86px_minmax(0,1fr)_88px] items-center gap-3" key={row.label}>
          <div>
            <div className="text-sm font-semibold text-slate-800">{row.label}</div>
            <div className="text-xs text-slate-500">{row.orders} orders</div>
          </div>
          <div className="h-10 overflow-hidden rounded-xl bg-slate-50">
            <div
              className="flex h-full min-w-8 items-center justify-end rounded-xl bg-blue-600 pr-3 text-xs font-semibold text-white"
              style={{ width: `${Math.max(8, (row.modules / maxModules) * 100)}%` }}
            >
              {row.modules}
            </div>
          </div>
          <div className="text-right text-sm font-semibold text-slate-700">{currency(row.revenue)}</div>
        </div>
      ))}
    </div>
  );
}

function FabricGraph({ rows }: { rows: FabricSummary[] }) {
  const maxModules = Math.max(...rows.map((row) => row.modules), 1);

  if (rows.length === 0) return <EmptyGraph label="No fabric demand yet." />;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.fabric}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-800">{row.fabric}</span>
            <span className="text-sm text-slate-500">{row.modules} modules</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-50">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(row.modules / maxModules) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryGraph({ rows }: { rows: InventorySummary[] }) {
  const maxAvailable = Math.max(...rows.map((row) => row.available), 1);

  if (rows.length === 0) return <EmptyGraph label="No inventory rows yet." />;

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.fabric}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-800">{row.fabric}</span>
            <span className="text-sm text-slate-500">{row.available} available</span>
          </div>
          <div className="flex h-8 overflow-hidden rounded-xl bg-slate-50">
            {MODULE_ORDER.map((module) => {
              const value = row.modules[module];
              return value > 0 ? (
                <div
                  className={[
                    "flex items-center justify-center text-[11px] font-semibold text-white",
                    module === "corner" ? "bg-blue-600" : "",
                    module === "armless" ? "bg-emerald-500" : "",
                    module === "ottoman" ? "bg-amber-500" : ""
                  ].join(" ")}
                  key={module}
                  style={{ width: `${Math.max(8, (value / maxAvailable) * 100)}%` }}
                >
                  {value}
                </div>
              ) : null;
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Corner</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Armless</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Ottoman</span>
      </div>
    </div>
  );
}

function StatusGraph({ rows }: { rows: StatusSummary[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) return <EmptyGraph label="No logistics status data yet." />;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3" key={row.label}>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">{row.label}</span>
              <span className="text-xs text-slate-500">{Math.round((row.count / total) * 100)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-50">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${(row.count / total) * 100}%` }} />
            </div>
          </div>
          <div className="text-right text-xl font-semibold text-slate-900">{row.count}</div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { supabase } = await requireUser();
  const [{ data: orders }, { data: inventory }] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select("created_at,total_modules,total_price,fabric_slug,logistics_status")
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<ShopifyOrder[]>(),
    supabase
      .from("inventory")
      .select("fabric_slug,module_slug,available_qty,reserved_qty")
      .order("fabric_slug", { ascending: true })
      .returns<InventoryRow[]>()
  ]);

  const safeOrders = orders ?? [];
  const safeInventory = inventory ?? [];
  const monthlyRows = buildMonthlySummary(safeOrders);
  const fabricRows = buildFabricSummary(safeOrders);
  const inventoryRows = buildInventorySummary(safeInventory);
  const statusRows = buildStatusSummary(safeOrders);
  const orderCount = safeOrders.length;
  const moduleCount = safeOrders.reduce((total, order) => total + getOrderModules(order), 0);
  const revenue = safeOrders.reduce((total, order) => total + getOrderRevenue(order), 0);
  const availableInventory = inventoryRows.reduce((total, row) => total + row.available, 0);

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Luun Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Home</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          A quick operating view of orders, demand, inventory, and logistics status.
        </p>
      </div>

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Orders imported" value={String(orderCount)} />
        <MetricTile label="Modules sold" value={String(moduleCount)} />
        <MetricTile label="Revenue imported" value={currency(revenue)} />
        <MetricTile label="Available inventory" value={String(availableInventory)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardPanel title="Orders by month" subtitle="Imported Shopify order count, module volume, and revenue.">
          <MonthlyGraph rows={monthlyRows} />
        </DashboardPanel>
        <DashboardPanel title="Fabric demand" subtitle="Which colours are pulling the most module volume.">
          <FabricGraph rows={fabricRows} />
        </DashboardPanel>
        <DashboardPanel title="Inventory by colour" subtitle="Available stock after reserved quantities.">
          <InventoryGraph rows={inventoryRows} />
        </DashboardPanel>
        <DashboardPanel title="Logistics status" subtitle="Where current orders sit operationally.">
          <StatusGraph rows={statusRows} />
        </DashboardPanel>
      </section>
    </main>
  );
}
