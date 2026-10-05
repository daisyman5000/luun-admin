import { unstable_cache } from 'next/cache';
import { DemandWorkspace } from '@/components/demand-workspace';
import { canManageInventory, canViewFinancials, requireUser } from '@/lib/auth';
import { readSale } from '@/lib/sales/store';
import { getWiseSummary } from '@/lib/wise/client';
import type { Counts } from '@/lib/sales/pricing';
import type { ContainerEntry, InventoryRow, ShopifyOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const getCachedWiseSummary = unstable_cache(getWiseSummary, ['wise-summary-demand'], { revalidate: 300 });
const empty = (): Counts => ({ corner: 0, armless: 0, ottoman: 0 });
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
export default async function DemandPage() {
  const { profile, supabase } = await requireUser();
  if (!canViewFinancials(profile?.role)) return <main className="p-8"><h1 className="text-2xl font-semibold">Demand Plan</h1><p className="mt-3 text-sm text-slate-500">Owner/admin access is required to view revenue forecasting.</p></main>;
  const now = Date.now();
  const since = now - 30 * 86400000;
  const [inventoryResult, orderResult, containerResult, wise, saleResult] = await Promise.all([
    supabase.from('inventory').select('available_qty,module_slug,reserved_qty').returns<Pick<InventoryRow, 'available_qty' | 'module_slug' | 'reserved_qty'>[]>(),
    supabase.from('shopify_orders').select('created_at,total_modules,total_price,payment_status,currency,corner_qty,armless_qty,ottoman_qty,raw_shopify_json').gte('created_at', new Date(since).toISOString()).order('created_at', { ascending: false }).limit(1000).returns<ShopifyOrder[]>(),
    supabase.from('container_entries').select('*').order('eta', { ascending: true, nullsFirst: false }).returns<ContainerEntry[]>(),
    getCachedWiseSummary().catch(() => null),
    readSale().then(sale => ({ sale, error: null })).catch(() => ({ sale: null, error: 'Sale status is unavailable. Refresh before relying on the forecast.' }))
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
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Demand Plan</h1>
    <p className="mt-1 mb-6 text-sm text-slate-500">Revenue forecast, connected to your website sale.</p>
    <DemandWorkspace canEdit={canManageInventory(profile?.role)} initialSale={saleResult.sale} saleError={saleResult.error} input={{ now, days: 30, inventory, incoming, modulesPerOrder: orders.length ? modules / orders.length : null, dailyOrders: orders.length ? orders.length / 30 : null, dailyBudget: spend / 30, acquisitionCost: spend > 0 && orders.length > 0 ? spend / orders.length : null, sale: saleResult.sale }} history={{ revenue: revenueValues.every(value => value !== null) ? revenueValues.reduce<number>((sum, value) => sum + (value || 0), 0) : null, orders: orders.length, modules, adSpend: spend, budgetAvailable: !!wise?.configured && wise.errors.length === 0, truncated: (orderResult.data || []).length === 1000 }} />
  </main>;
}
