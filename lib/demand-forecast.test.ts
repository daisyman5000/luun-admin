import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastDemand, type ForecastInput } from './demand-forecast';
import { DEFAULT_SALE } from './sales/types';

const now = Date.parse('2026-10-05T20:00:00Z');
const base: ForecastInput = { now, days: 2, inventory: { corner: 100, armless: 0, ottoman: 0 }, incoming: [], modulesPerOrder: 3, dailyOrders: 1, dailyBudget: 100, acquisitionCost: 100, sale: null };
test('live sale applies only until its saved end, with regular pricing afterwards', () => {
  const regular = forecastDemand(base);
  const sale = { ...DEFAULT_SALE, enabled: true, status: 'ready' as const, starts_at: new Date(now).toISOString(), ends_at: new Date(now + 86400000).toISOString() };
  const actual = forecastDemand({ ...base, sale });
  const regularUnit = 148462 - Math.floor(148462 * 1100 / 10000);
  const saleUnit = 148462 - Math.floor(148462 * 4215 / 10000);
  assert.equal(actual.revenue, 3 * (regularUnit + saleUnit) / 100);
  assert.equal(actual.orders, regular.orders);
});
test('saved dates, failed activation and ended sales never discount forecasts', () => {
  const sale = { ...DEFAULT_SALE, starts_at: new Date(now).toISOString(), ends_at: new Date(now + 86400000).toISOString() };
  const regular = forecastDemand(base).revenue;
  assert.equal(forecastDemand({ ...base, sale }).revenue, regular);
  assert.equal(forecastDemand({ ...base, sale: { ...sale, enabled: true, status: 'error' } }).revenue, regular);
  assert.equal(forecastDemand({ ...base, sale: { ...sale, enabled: true, status: 'ready', ends_at: new Date(now).toISOString() } }).revenue, regular);
});
test('stock caps sales, never goes negative, and does not automatically stop advertising', () => {
  const forecast = forecastDemand({ ...base, inventory: { corner: 2, armless: 0, ottoman: 0 } });
  assert.equal(forecast.modules, 2); assert.equal(forecast.stock.corner, 0); assert.equal(forecast.adSpend, 200); assert.equal(forecast.constrained, true);
});
test('future containers become available once, unknown and overdue ETAs are excluded', () => {
  const forecast = forecastDemand({ ...base, inventory: { corner: 0, armless: 0, ottoman: 0 }, incoming: [
    { eta: '2026-10-06', modules: { corner: 3, armless: 0, ottoman: 0 } },
    { eta: null, modules: { corner: 10, armless: 0, ottoman: 0 } },
    { eta: '2026-10-01', modules: { corner: 10, armless: 0, ottoman: 0 } }
  ] });
  assert.equal(forecast.modules, 3); assert.equal(forecast.stock.corner, 0);
});
test('missing orders are unavailable instead of invented, and organic pace works without ad history', () => {
  assert.equal(forecastDemand({ ...base, modulesPerOrder: null, dailyOrders: null, acquisitionCost: null }).revenue, null);
  assert.equal(forecastDemand({ ...base, acquisitionCost: null, dailyBudget: 0 }).orders, 2);
});
test('partial sale day is weighted exactly across the end timestamp', () => {
  const full = forecastDemand({ ...base, days: 1, sale: { ...DEFAULT_SALE, enabled: true, status: 'ready', starts_at: new Date(now).toISOString(), ends_at: new Date(now + 86400000).toISOString() } });
  const regular = forecastDemand({ ...base, days: 1 });
  const half = forecastDemand({ ...base, days: 1, sale: { ...DEFAULT_SALE, enabled: true, status: 'ready', starts_at: new Date(now).toISOString(), ends_at: new Date(now + 43200000).toISOString() } });
  assert.equal(half.revenue, (full.revenue! + regular.revenue!) / 2);
});
