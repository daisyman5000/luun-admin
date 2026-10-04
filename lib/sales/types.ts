export type SaleState = {
  id: number; enabled: boolean; status: 'off' | 'syncing' | 'ready' | 'error';
  updated_at?: string; version: number; name: string; announcement: string; delivery_message: string;
  starts_at: string | null; ends_at: string | null; shopify_discount_id: string | null;
  last_error: string | null;
};
export const DEFAULT_SALE: SaleState = {
  id:1, enabled:false, status:'off', version:0, name:'Black Friday',
  announcement:'Black Friday · An extra 35% off your configuration',
  delivery_message:'Limited availability from our incoming shipment.', starts_at:null,
  ends_at:null, shopify_discount_id:null, last_error:null
};
export function isSaleActive(sale: SaleState, now = Date.now()) {
  return sale.enabled && sale.status === 'ready' && !!sale.starts_at && !!sale.ends_at &&
    now >= Date.parse(sale.starts_at) && now < Date.parse(sale.ends_at);
}
export function cleanSale(body: Record<string, unknown>) {
  const text = (key: string, max: number) => {
    if (typeof body[key] !== 'string' || (body[key] as string).length > max) throw new Error(`Invalid ${key}`);
    return (body[key] as string).trim();
  };
  const starts_at = typeof body.starts_at === 'string' && Number.isFinite(Date.parse(body.starts_at)) ? new Date(body.starts_at).toISOString() : null;
  const ends_at = typeof body.ends_at === 'string' && Number.isFinite(Date.parse(body.ends_at)) ? new Date(body.ends_at).toISOString() : null;
  if (!starts_at || !ends_at || Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error('Choose a valid start and end time');
  const name = text('name', 80);
  if (!name) throw new Error('Sale name required');
  return { name, announcement:text('announcement',200), delivery_message:text('delivery_message',200), starts_at, ends_at };
}
