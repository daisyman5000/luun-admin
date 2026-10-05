import { MODULE_CENTS, quantityRate, saleBasisPoints, type Counts } from './sales/pricing';
import type { SaleState } from './sales/types';

const DAY = 86400000;
const keys = Object.keys(MODULE_CENTS) as (keyof Counts)[];
export function arrivalTime(eta: string | null) {
  if (!eta) return NaN;
  const utc = Date.parse(`${eta}T12:00:00Z`);
  if (!Number.isFinite(utc)) return NaN;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc));
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  const local = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  return utc + (utc - local);
}
export type ForecastInput = {
  now: number;
  days: number;
  inventory: Counts;
  incoming: { eta: string | null; modules: Counts }[];
  modulesPerOrder: number | null;
  dailyOrders: number | null;
  dailyBudget: number;
  acquisitionCost: number | null;
  sale: SaleState | null;
};
export function forecastDemand(input: ForecastInput) {
  const stock = { ...input.inventory };
  const rate = input.acquisitionCost && input.acquisitionCost > 0
    ? input.dailyBudget / input.acquisitionCost : input.dailyOrders;
  const ready = rate !== null && Number.isFinite(rate) && rate >= 0 && !!input.modulesPerOrder && input.modulesPerOrder > 0;
  const unitsPerOrder = Math.max(1, Math.round(input.modulesPerOrder || 1));
  const regularBps = Math.round(quantityRate(unitsPerOrder) * 10000);
  const promotionBps = saleBasisPoints(unitsPerOrder);
  const sale = input.sale;
  // Saved dates alone do not mean a promotion is running.
  const saleStart = sale?.enabled && sale.status === 'ready' && sale.starts_at ? Date.parse(sale.starts_at) : NaN;
  const saleEnd = sale?.ends_at ? Date.parse(sale.ends_at) : NaN;
  const deliveries = input.incoming.map(item => ({ ...item, time: arrivalTime(item.eta) }))
    .filter(item => Number.isFinite(item.time) && item.time >= input.now);
  let revenue = 0, orders = 0, modules = 0, adSpend = 0, constrained = false;
  const rows: { startsAt: string; endsAt: string; revenue: number; orders: number; modules: number; adSpend: number }[] = [];
  for (let index = 0; index < input.days; index++) {
    const start = input.now + index * DAY;
    const end = start + DAY;
    // Split at arrivals and sale boundaries so stock and prices never apply early.
    const cuts = [...new Set([start, end, ...deliveries.map(item => item.time), saleStart, saleEnd].filter(time => Number.isFinite(time) && time >= start && time <= end))].sort((a, b) => a - b);
    let dayRevenue = 0, dayOrders = 0, dayModules = 0;
    for (let segment = 0; segment < cuts.length - 1; segment++) {
      const at = cuts[segment];
      for (const delivery of deliveries) if (delivery.time === at) for (const key of keys) stock[key] += Math.max(0, delivery.modules[key]);
      const share = (cuts[segment + 1] - at) / DAY;
      const available = keys.reduce((sum, key) => sum + Math.max(0, stock[key]), 0);
      const requested = ready ? (rate || 0) * (input.modulesPerOrder || 0) * share : 0;
      const sold = Math.min(requested, available);
      if (requested > available) constrained = true;
      const bps = at >= saleStart && at < saleEnd ? promotionBps : regularBps;
      for (const key of keys) {
        const quantity = available > 0 ? sold * Math.max(0, stock[key]) / available : 0;
        const unit = MODULE_CENTS[key] - Math.floor(MODULE_CENTS[key] * bps / 10000);
        dayRevenue += quantity * unit / 100;
        stock[key] = Math.max(0, stock[key] - quantity);
      }
      dayOrders += sold / (input.modulesPerOrder || 1); dayModules += sold;
    }
    // Advertising is still spent when stock runs out; do not imply automatic ad pausing.
    const daySpend = input.dailyBudget;
    revenue += dayRevenue; orders += dayOrders; modules += dayModules; adSpend += daySpend;
    const rowIndex = Math.floor(index / 7);
    if (!rows[rowIndex]) rows[rowIndex] = { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), revenue: 0, orders: 0, modules: 0, adSpend: 0 };
    const row = rows[rowIndex];
    row.endsAt = new Date(end).toISOString(); row.revenue += dayRevenue; row.orders += dayOrders; row.modules += dayModules; row.adSpend += daySpend;
  }
  return { ready, revenue: ready ? revenue : null, orders: ready ? orders : null, modules: ready ? modules : null, adSpend, stock, constrained, rows, unitsPerOrder };
}
