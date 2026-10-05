export const SALE_RATE = 0.35;
export const MODULE_CENTS = { corner: 148462, armless: 107692, ottoman: 61538 };
export const SALE_TIERS = [{min:1,bps:3500},{min:3,bps:4215},{min:4,bps:4410},{min:6,bps:4475}] as const;
export function saleBasisPoints(pieces:number){return pieces>=6?4475:pieces>=4?4410:pieces===3?4215:3500;}
export type Counts = Record<keyof typeof MODULE_CENTS, number>;
export function quantityRate(count: number) { return count >= 6 ? 0.15 : count >= 4 ? 0.14 : count === 3 ? 0.11 : 0; }
export function validateCounts(value: unknown): Counts {
  if (!value || typeof value !== 'object') throw new Error('Module counts required');
  const counts = value as Counts;
  for (const key of Object.keys(MODULE_CENTS) as (keyof Counts)[]) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0 || counts[key] > 100) throw new Error('Invalid module count');
  }
  if (!Object.values(counts).reduce((a,b) => a+b, 0)) throw new Error('Choose at least one module');
  return counts;
}
// Shopify quantity discounts round the per-unit savings down to cents.
// Activation must compare these estimates against authoritative Shopify carts.
export function quote(counts: Counts, active: boolean) {
  const pieces = Object.values(counts).reduce((a,b) => a+b, 0);
  const rate = quantityRate(pieces);
  const regularCents = (Object.keys(MODULE_CENTS) as (keyof Counts)[]).reduce((sum,key) => {
    const unit = MODULE_CENTS[key];
    return sum + counts[key] * (unit - Math.floor((unit * Math.round(rate * 100)) / 100));
  }, 0);
  const bps=saleBasisPoints(pieces);
  const saleCents=(Object.keys(MODULE_CENTS) as (keyof Counts)[]).reduce((sum,key)=>sum+counts[key]*(MODULE_CENTS[key]-Math.floor(MODULE_CENTS[key]*bps/10000)),0);
  return { pieces, quantityRate: rate, regularCents, saleCents, totalCents: active ? saleCents : regularCents };
}
export const CHECK_CONFIGS: Counts[] = [
  {corner:2,armless:0,ottoman:0}, {corner:2,armless:1,ottoman:0},
  {corner:2,armless:1,ottoman:1}, {corner:2,armless:2,ottoman:1},
  {corner:2,armless:3,ottoman:1}, {corner:3,armless:3,ottoman:1}
];
