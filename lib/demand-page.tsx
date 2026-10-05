import { unstable_cache } from 'next/cache';
import { DemandDecisions } from '@/components/demand-decisions';
import { readPlanningSettings, type StockDemand } from '@/lib/demand-plan';
import { DemandWorkspace } from '@/components/demand-workspace';
import { canManageInventory, canViewFinancials, requireUser } from '@/lib/auth';
import { readSale } from '@/lib/sales/store';
import { getWiseSummary } from '@/lib/wise/client';
import type { Counts } from '@/lib/sales/pricing';
import type { ContainerEntry, InventoryRow, ShopifyOrder } from '@/lib/types';

const getCachedWiseSummary = unstable_cache(getWiseSummary, ['wise-summary-demand'], { revalidate: 300 });
const empty = (): Counts => ({ corner: 0, armless: 0, ottoman: 0 });
const fabricKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function moduleKey(value: string | null | undefined): keyof Counts | null {
  const text = (value || '').toLowerCase();
  return text.includes('corner') || text === 'cor' ? 'corner' : text.includes('armless') || text.includes('side') ? 'armless' : text.includes('ottoman') || text === 'ott' ? 'ottoman' : null;
}
type RawOrder = {
  cancelledAt?: string | null;
  lineItems?: { edges?: { node?: { discountedTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } }; originalTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } } } }[] };
};
function productRevenue(order: ShopifyOrder): number | null {
  const lines = (order.raw_shopify_json as RawOrder | null)?.lineItems?.edges;
  if (!lines?.length) return null;
  let total = 0;
  for (const line of lines) {
    const money = line.node?.discountedTotalSet?.shopMoney || line.node?.originalTotalSet?.shopMoney;
    if (money?.currencyCode !== 'CAD' || !Number.isFinite(Number(money.amount))) return null;
    total += Number(money.amount);
  }
  return total;
}
export async function renderDemandPage(planOnly: boolean) {
  const { profile, supabase } = await requireUser();
  if (!canViewFinancials(profile?.role)) return <main className="p-8"><h1 className="text-2xl font-semibold">Demand Plan</h1><p className="mt-3 text-sm text-slate-500">Owner/admin access is required to view revenue forecasting.</p></main>;
  const now = Date.now();
  const since = now - 30 * 86400000;
  const [inventoryResult, orderResult, containerResult, wise, saleResult, planningResult] = await Promise.all([
    supabase.from('inventory').select('available_qty,module_slug,reserved_qty,fabric_slug').returns<Pick<InventoryRow, 'available_qty' | 'module_slug' | 'reserved_qty' | 'fabric_slug'>[]>(),
    supabase.from('shopify_orders').select('created_at,fabric_slug,total_modules,total_price,payment_status,currency,corner_qty,armless_qty,ottoman_qty,raw_shopify_json').gte('created_at', new Date(since).toISOString()).order('created_at', { ascending: false }).limit(1000).returns<ShopifyOrder[]>(),
    supabase.from('container_entries').select('*').order('eta', { ascending: true, nullsFirst: false }).returns<ContainerEntry[]>(),
    getCachedWiseSummary().catch(() => null),
    readSale().then(sale => ({ sale, error: null })).catch(() => ({ sale: null, error: 'Sale status is unavailable. Refresh before relying on the forecast.' })),
    supabase.from('demand_planning_settings').select('settings').eq('id', 1).maybeSingle()
  ]);
  if (inventoryResult.error || orderResult.error || containerResult.error) return <main className="p-8"><h1 className="text-2xl font-semibold">Demand Plan</h1><p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">Unable to load inventory, orders or shipments. Refresh to retry.</p></main>;
  const inventory = (inventoryResult.data || []).reduce((stock, row) => {
    const key = moduleKey(row.module_slug);
    if (key) stock[key] += Math.max(0, Number(row.available_qty || 0) - Number(row.reserved_qty || 0));
    return stock;
  }, empty());
  const orders = (orderResult.data || []).filter(order => order.currency === 'CAD' && order.payment_status?.toUpperCase() === 'PAID' && Number(order.total_modules) > 0 && !(order.raw_shopify_json as RawOrder | null)?.cancelledAt && Date.parse(order.created_at) <= now);
  const modules = orders.reduce((sum, order) => sum + Number(order.total_modules || 0), 0);
  const spend = (wise?.metaSpend.expenses || []).filter(expense => expense.currency === 'CAD' && Date.parse(expense.date) >= since && Date.parse(expense.date) <= now).reduce((sum, expense) => sum + expense.amount, 0);
  const revenueValues = orders.map(productRevenue);
  const incoming = (containerResult.data || []).filter(container => container.status === 'in_transit' || container.status === 'production').map(container => ({
    eta: container.eta,
    modules: (container.manifest_json || []).reduce((stock, item) => { const key = moduleKey(item.module); if (key) stock[key] += Math.max(0, Number(item.quantity || 0)); return stock; }, empty())
  }));
  const stockRows = new Map<string, StockDemand>();
  for (const row of inventoryResult.data || []) {
    const key = moduleKey(row.module_slug);
    if (!key || !row.fabric_slug) continue;
    const id = `${fabricKey(row.fabric_slug)}:${key}`;
    const current = stockRows.get(id) || { key: id, stock: 0, dailyModules: 0 };
    current.stock += Math.max(0, Number(row.available_qty || 0) - Number(row.reserved_qty || 0));
    stockRows.set(id, current);
  }
  for (const order of orders) for (const key of ['corner', 'armless', 'ottoman'] as const) {
    if (!order.fabric_slug) continue;
    const id = `${fabricKey(order.fabric_slug)}:${key}`;
    const current = stockRows.get(id) || { key: id, stock: 0, dailyModules: 0 };
    current.dailyModules += Number(order[`${key}_qty`] || 0) / 30;
    stockRows.set(id, current);
  }
  const planningIncoming = (containerResult.data || []).filter(c => c.status === 'production' || c.status === 'in_transit').map(c => ({ eta: c.eta, stock: (c.manifest_json || []).reduce<Record<string,number>>((result,item) => {
    const key = moduleKey(item.module); if (key) { const id = `${fabricKey(item.color)}:${key}`; result[id] = (result[id] || 0) + Math.max(0, Number(item.quantity || 0)); } return result;
  }, {}) }));
  if (planOnly) return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><h1 className="text-2xl font-semibold tracking-tight">Daily Plan</h1><p className="mb-6 mt-1 text-sm text-slate-500">Daily ads, sale dates and your next container.</p><DemandDecisions canEdit={canManageInventory(profile?.role)} initialError={planningResult.error ? 'Planning settings need the database migration before they can be saved.' : null} input={{ now, rows: [...stockRows.values()], incoming: planningIncoming, dailyOrders: orders.length ? orders.length / 30 : null, settings: readPlanningSettings(planningResult.data?.settings), blocked: (orderResult.data || []).length === 1000 || orders.some(order => !order.fabric_slug) }} /></main>;
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Demand Plan</h1>
    <p className="mt-1 mb-6 text-sm text-slate-500">Daily ad spend, sale dates and your next container order.</p>
    <DemandWorkspace planning={{ now, rows: [...stockRows.values()], incoming: planningIncoming, dailyOrders: orders.length ? orders.length / 30 : null, settings: readPlanningSettings(planningResult.data?.settings), blocked: (orderResult.data || []).length === 1000 || orders.some(order => !order.fabric_slug) }} planningError={planningResult.error ? "Planning settings are not installed yet. Apply the planning migration to save settings." : null} canEdit={canManageInventory(profile?.role)} initialSale={saleResult.sale} saleError={saleResult.error} input={{ now, days: 30, inventory, incoming, modulesPerOrder: orders.length ? modules / orders.length : null, dailyOrders: orders.length ? orders.length / 30 : null, dailyBudget: spend / 30, acquisitionCost: spend > 0 && orders.length > 0 ? spend / orders.length : null, sale: saleResult.sale }} history={{ revenue: revenueValues.every(value => value !== null) ? revenueValues.reduce<number>((sum, value) => sum + (value || 0), 0) : null, orders: orders.length, modules, adSpend: spend, budgetAvailable: !!wise?.configured && wise.errors.length === 0, truncated: (orderResult.data || []).length === 1000 }} />
  </main>;
}
