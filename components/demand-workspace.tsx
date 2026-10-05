"use client";

import { useEffect, useState } from 'react';
import { DemandDecisions } from './demand-decisions';
import type { PlanInput } from '@/lib/demand-plan';
import { DemandSaleControl } from './demand-sale-control';
import { forecastDemand, type ForecastInput } from '@/lib/demand-forecast';
import { isSaleActive, type SaleState } from '@/lib/sales/types';

const money = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(value));
type Props = {
  planning: PlanInput;
  planningError: string | null;
  canEdit: boolean;
  input: ForecastInput;
  initialSale: SaleState | null;
  saleError: string | null;
  history: { revenue: number | null; orders: number; modules: number; adSpend: number; budgetAvailable: boolean; truncated: boolean };
};
function Metric({ label, value, detail, primary = false }: { label: string; value: string; detail: string; primary?: boolean }) {
  return <div className={primary ? 'rounded-2xl bg-slate-950 p-5 text-white' : 'rounded-2xl border border-line bg-white p-5'}>
    <p className={primary ? 'text-sm text-slate-300' : 'text-sm text-slate-500'}>{label}</p>
    <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    <p className={primary ? 'mt-2 text-xs text-slate-400' : 'mt-2 text-xs text-slate-500'}>{detail}</p>
  </div>;
}
export function DemandWorkspace({ planning, planningError, canEdit, input, initialSale, saleError, history }: Props) {
  const [sale, setSale] = useState(initialSale);
  const [budget, setBudget] = useState(input.dailyBudget);
  const [days, setDays] = useState(30);
  const [now, setNow] = useState(input.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const forecast = forecastDemand({ ...input, now, days, dailyBudget: budget, sale });
  const active = sale ? isSaleActive(sale, now) : false;
  const forecastReady = forecast.ready && !saleError && !history.truncated;
  const maxRevenue = Math.max(1, ...forecast.rows.map(row => row.revenue));
  const stock = Object.values(forecast.stock).reduce((sum, value) => sum + value, 0);
  return <div className="space-y-5">
    <DemandDecisions input={{ ...planning, now }} canEdit={canEdit} initialError={planningError} />
    {saleError ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{saleError}</p> : null}
    {history.truncated ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Order history reached the 1,000-order limit. This forecast needs a larger import window.</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><label className="text-lg font-semibold"><span className="sr-only">Forecast period</span><select aria-label="Forecast period" className="bg-transparent pr-3" value={days} onChange={event => setDays(Number(event.target.value))}><option value={30}>Next 30 days</option><option value={60}>Next 60 days</option><option value={90}>Next 90 days</option></select></label><p className="mt-1 text-xs text-slate-500">{date(new Date(now).toISOString())} – {date(new Date(now + days * 86400000).toISOString())} · CAD</p></div>
      <span className={active ? 'rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600'}>{saleError ? 'Sale status unavailable' : active ? `${sale?.name} · ends ${date(sale!.ends_at!)}` : 'Sale off · regular pricing'}</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric primary label="Projected revenue" value={saleError || history.truncated ? '—' : money(forecast.revenue)} detail="Product sales before shipping and tax" />
      <Metric label="Expected orders" value={forecastReady ? number(forecast.orders) : '—'} detail={forecastReady ? `${number(forecast.modules)} modules` : 'Forecast unavailable'} />
      <Metric label="Planned ad spend" value={money(forecast.adSpend)} detail={`${money(budget)} per day`} />
      <Metric label="Modules left" value={forecastReady ? number(stock) : '—'} detail="Stock after forecast sales and arrivals" />
    </div>
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-semibold">Revenue by week</h3>
        <label className="flex items-center gap-2 text-sm text-slate-500">Daily ad budget
          <span className="text-slate-400">$</span><input aria-label="Daily ad budget in CAD" className="w-24 rounded-lg border border-line p-2 text-right text-slate-950" type="number" min={0} max={5000} step={10} value={Math.round(budget * 100) / 100} onChange={event => setBudget(Math.max(0, Math.min(5000, Number(event.target.value) || 0)))} />
        </label>
      </div>
      {!forecastReady ? <p className="mt-5 text-sm text-slate-500">{saleError || history.truncated ? 'Forecast paused until the data warning above is resolved.' : 'Not enough paid module orders in the last 30 days to forecast. Sync Shopify orders from Data to populate this view.'}</p> : <div className="mt-5 space-y-4">{forecast.rows.map(row => <div key={row.startsAt} className="grid grid-cols-[90px_1fr_88px] items-center gap-3 text-sm">
        <span className="text-xs text-slate-500">{date(row.startsAt)} – {date(new Date(Date.parse(row.endsAt) - 1).toISOString())}</span>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${row.revenue / maxRevenue * 100}%` }} /></div>
        <span className="text-right font-medium">{money(row.revenue)}</span>
      </div>)}</div>}
      {forecast.constrained ? <p className="mt-4 text-sm text-amber-800">Stock limits this forecast. Ads are still budgeted after stock runs out; lower the budget or update incoming shipments.</p> : null}
      <p className="mt-4 text-xs text-slate-500">Budget changes here are estimates only. Sale dates and prices follow the live website sale automatically.</p>
    </section>
    <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-xs text-slate-500"><span>Last 30 days: <strong className="text-slate-700">{money(history.revenue)} paid product sales</strong></span><span>{history.orders} paid orders</span><span>{history.budgetAvailable ? `${money(history.adSpend)} recorded Meta spend` : 'Meta spend unavailable'}</span></div>
    <DemandSaleControl canEdit={canEdit} initialSale={initialSale} onSaleChange={setSale} />
    <details className="rounded-2xl border border-line bg-white p-4 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium text-slate-700">Forecast assumptions</summary>
      <div className="mt-3 space-y-2 leading-5">
        <p>Uses imported paid CAD module orders and recorded Meta payments from the last 30 days. Refunded and unpaid orders are excluded. Paid revenue uses discounted product line totals, excluding shipping and tax.</p>
        <p>{input.acquisitionCost ? `Recorded ad spend per paid order: ${money(input.acquisitionCost)}. Orders are estimated as daily budget divided by this historical blended cost.` : 'No usable advertising cost is available. Order pace follows the last 30 days; changing ad budget changes spending only.'} This assumes conversion stays constant; no sale uplift is invented.</p>
        <p>Average order: {number(input.modulesPerOrder)} modules. Pricing uses current builder prices with the quantity tier for an estimated {forecast.unitsPerOrder}-module order. The extra 35% applies only during an enabled sale, and ends automatically in the forecast at its saved end time.</p>
        <p>Sales use the available module mix. Unreserved on-hand stock and production/in-transit containers with future ETAs limit projected units. Unknown or overdue arrivals are excluded. ETAs are modeled at noon Pacific; this is an estimate across fabrics, not a fulfilment promise.</p>
        <p>Daily budget defaults to recorded Meta payments averaged over 30 days. Changing it here is a temporary scenario and never changes your advertising account. Recorded payments can lag actual ad delivery. Revenue minus ad spend is not profit.</p>
      </div>
    </details>
  </div>;
}
