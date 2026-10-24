import {validDay} from './forecast-actual';
export const LUUN_GA4_PROPERTY = '437643167';
export const GA4_EVENTS = ['session_start', 'builder_open', 'add_to_cart', 'begin_checkout', 'purchase'] as const;
export const GA4_LABELS = {session_start: 'Session starts', builder_open: 'Builder opens', add_to_cart: 'Add to cart', begin_checkout: 'Checkout starts', purchase: 'Purchases'};
export type GA4Event = {name: string; count: number; users: number};
export type GA4Report = {propertyId: string; from: string; through: string; fetchedAt: string; timeZone: string | null; events: GA4Event[]; sessions: number | null; totalUsers: number | null; source: 'api' | 'export'; warning?: string};
export function validGA4Range(from: string, through: string) {
  return validDay(from) && validDay(through) && through >= from && Date.parse(through) - Date.parse(from) <= 31 * 86400000;
}
export function ga4Number(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error('Invalid Analytics count');
  return Number(value);
}
export function parseGA4Events(response: {dimensionHeaders?: {name: string}[]; metricHeaders?: {name: string}[]; rows?: {dimensionValues?: {value: string}[]; metricValues?: {value: string}[]}[]; rowCount?: number}) {
  if (response.dimensionHeaders?.[0]?.name !== 'eventName' || response.metricHeaders?.[0]?.name !== 'eventCount' || response.metricHeaders?.[1]?.name !== 'totalUsers') throw Error('Unexpected Analytics report');
  if ((response.rowCount || 0) > 100 || (response.rows?.length || 0) > 100) throw Error('Analytics report exceeds limit');
  const seen = new Set<string>();
  return (response.rows || []).map(row => {
    const name = row.dimensionValues?.[0]?.value;
    if (!name || !GA4_EVENTS.includes(name as typeof GA4_EVENTS[number]) || seen.has(name)) throw Error('Unexpected Analytics event');
    seen.add(name);
    return {name, count: ga4Number(row.metricValues?.[0]?.value), users: ga4Number(row.metricValues?.[1]?.value)};
  });
}
export function validateGA4Snapshot(value: unknown): GA4Report {
  const r = value as GA4Report;
  if (!r || r.propertyId !== LUUN_GA4_PROPERTY || r.source !== 'export' || !validGA4Range(r.from, r.through) || !Number.isFinite(Date.parse(r.fetchedAt)) || !Array.isArray(r.events) || r.events.length > 100) throw Error('Invalid saved Analytics report');
  for (const e of r.events) if (!GA4_EVENTS.includes(e.name as typeof GA4_EVENTS[number]) || !Number.isSafeInteger(e.count) || e.count < 0 || !Number.isSafeInteger(e.users) || e.users < 0) throw Error('Invalid saved Analytics event');
  return r;
}
