import { arrivalTime } from './demand-forecast';
export type PlanningSettings = { leadDays: number | null; bufferDays: number | null; costPerPaidOrder: number | null; organicOrders: number | null; saleLift: number | null; maxBudget: number | null };
export const EMPTY_PLANNING: PlanningSettings = { leadDays: null, bufferDays: null, costPerPaidOrder: null, organicOrders: null, saleLift: null, maxBudget: null };
export function readPlanningSettings(value: unknown): PlanningSettings {
  const result = { ...EMPTY_PLANNING };
  if (!value || typeof value !== 'object') return result;
  const ranges: Record<keyof PlanningSettings, [number,number]> = { leadDays:[1,730],bufferDays:[0,180],costPerPaidOrder:[0.01,10000],organicOrders:[0,10000],saleLift:[1,20],maxBudget:[0,5000] };
  for (const key of Object.keys(ranges) as (keyof PlanningSettings)[]) {
    const entry = (value as Record<string,unknown>)[key];const [min,max] = ranges[key];
    if (typeof entry === 'number' && Number.isFinite(entry) && entry >= min && entry <= max) result[key]=entry;
  }
  return result;
}
export type StockDemand = { key: string; stock: number; dailyModules: number };
export type PlanInput = { now: number; rows: StockDemand[]; incoming: { eta: string | null; stock: Record<string, number> }[]; dailyOrders: number | null; settings: PlanningSettings; blocked?: boolean };
const DAY = 86400000;
export function calculatePlan(input: PlanInput) {
  const { now } = input;
  const s = readPlanningSettings(input.settings);
  const unavailable = { budget: null, saleStart: null, saleEnd: null, orderDate: null, limiting: null, reason: 'Sync paid orders and stock before planning.' };
  if (input.blocked || !input.dailyOrders || !Number.isFinite(input.dailyOrders) || !input.rows.length) return unavailable;
  if (s.bufferDays === null || s.leadDays === null) return { ...unavailable, reason: 'Set container lead time and stock buffer.' };
  const deliveries = input.incoming.map(x => ({ ...x, time: x.eta && /^\d{4}-\d{2}-\d{2}$/.test(x.eta) ? arrivalTime(x.eta) : NaN })).filter(x => Number.isFinite(x.time) && x.time >= now).sort((a,b) => a.time-b.time);
  const rows = input.rows.filter(x => x.dailyModules > 0 && Number.isFinite(x.dailyModules));
  if (!rows.length) return unavailable;
  function deadline(regularPace: number, promotionPace = regularPace, saleDays = 0) {
    let breach = Infinity, limiting: string | null = null;
    const saleEnd = now + saleDays * DAY;
    for (const row of rows) {
      let stock = row.stock, at = now;
      const perOrder = row.dailyModules / input.dailyOrders!;
      const buffer = row.dailyModules * s.bufferDays!;
      const events = [...new Set([...deliveries.map(d => d.time), ...(saleDays > 0 ? [saleEnd] : [])])].sort((a,b)=>a-b);
      let candidate = Infinity;
      for (const time of [...events, Infinity]) {
        const rate = perOrder * (at < saleEnd ? promotionPace : regularPace);
        candidate = stock <= buffer ? at : rate > 0 ? at + (stock-buffer) / rate * DAY : Infinity;
        if (candidate < time || !Number.isFinite(time)) break;
        stock -= rate * (time-at) / DAY;
        for (const delivery of deliveries) if (delivery.time === time) stock += Math.max(0, delivery.stock[row.key] || 0);
        at = time;
      }
      if (candidate < breach) { breach = candidate; limiting = row.key; }
    }
    return { orderDate: Number.isFinite(breach) ? new Date(breach - s.leadDays! * DAY).toISOString() : null, limiting };
  }
  let { orderDate, limiting } = deadline(input.dailyOrders);
  // Pace each demanded SKU to its own replenishment; the bottleneck caps all orders.
  let targetOrders = Infinity, horizon = Infinity;
  for (const row of rows) {
    const arrival = deliveries.find(x => (x.stock[row.key] || 0) > 0);
    if (!arrival) return { ...unavailable, orderDate, limiting, reason: `No confirmed replenishment ETA for ${row.key}. Container deadline uses current sales pace.` };
    const days = Math.max(1, (arrival.time-now)/DAY);
    const modulesPerOrder = row.dailyModules / input.dailyOrders;
    const usable = Math.max(0, row.stock - row.dailyModules*s.bufferDays);
    const target = usable / days / modulesPerOrder;
    if (target < targetOrders) { targetOrders = target; horizon = days; }
  }
  if (s.costPerPaidOrder === null || s.organicOrders === null || s.maxBudget === null) return { ...unavailable, orderDate, limiting, reason: 'Set paid-order acquisition cost, non-ad orders/day and daily spending limit. Meta payments are not acquisition cost.' };
  const required = Math.max(0, targetOrders - s.organicOrders) * s.costPerPaidOrder;
  const budget = Math.min(required, s.maxBudget);
  const regularPace = s.organicOrders + budget / s.costPerPaidOrder;
  ({ orderDate, limiting } = deadline(regularPace));
  if (required <= s.maxBudget) return { budget, saleStart: null, saleEnd: null, orderDate, limiting, reason: 'This ad budget meets the replenishment pace without a sale.' };
  if (s.saleLift === null) return { budget, saleStart: null, saleEnd: null, orderDate, limiting, reason: 'Spending limit leaves a sales gap. Enter measured sale uplift to calculate dates.' };
  const salePace = regularPace * s.saleLift;
  if (salePace <= targetOrders) return { budget, saleStart: null, saleEnd: null, orderDate, limiting, reason: 'Even the measured sale pace cannot meet replenishment pacing within this spending limit.' };
  // Close only the shortfall left by the capped regular-price ad budget.
  const duration = horizon*(targetOrders-regularPace)/(salePace-regularPace);
  // A whole-day sale must not consume the SKU buffer before replenishment.
  if (rows.some(row => {
    const arrival = deliveries.find(d => (d.stock[row.key] || 0) > 0)!;
    const days = Math.max(1,(arrival.time-now)/DAY), perOrder=row.dailyModules/input.dailyOrders!;
    return perOrder*(Math.min(duration,days)*salePace + Math.max(0,days-duration)*regularPace) > row.stock-row.dailyModules*s.bufferDays!+1e-8;
  })) return { budget, saleStart:null,saleEnd:null,orderDate,limiting,reason:'A full-day sale would cross a module stock buffer. Keep this budget; no sale window is recommended.' };
  ({ orderDate, limiting } = deadline(regularPace,salePace,duration));
  return { budget, saleStart: new Date(now).toISOString(), saleEnd: new Date(now+duration*DAY).toISOString(), orderDate, limiting, reason: 'Sale closes the sales gap left by the spending limit. Container deadline includes this planned pace.' };
}
