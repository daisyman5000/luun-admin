"use client";
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SALE, isSaleActive, type SaleState } from '@/lib/sales/types';
const localTime = (value: string | null) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
type Props = { canEdit: boolean; initialSale?: SaleState | null; onSaleChange?: (sale: SaleState) => void };
export function DemandSaleControl({ canEdit, initialSale, onSaleChange }: Props) {
  const [sale, setSale] = useState<SaleState>(initialSale || DEFAULT_SALE);
  const [loaded, setLoaded] = useState(!!initialSale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [end, setEnd] = useState(localTime(initialSale?.ends_at || null));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setEnd(localTime(sale.ends_at)); }, [sale.ends_at]);
  const load = useCallback(async () => {
    const response = await fetch('/api/sale-control', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load sale status.');
    setSale(current => current.version === body.sale.version ? current : body.sale);
    setLoaded(true); onSaleChange?.(body.sale);
    return body.sale as SaleState;
  }, [onSaleChange]);
  useEffect(() => {
    if (!canEdit) return;
    if (!initialSale) void load().then(next => setEnd(localTime(next.ends_at))).catch(error => setError(error.message));
    const timer = window.setInterval(() => { setNow(Date.now()); if (!busy) void load().catch(error => setError(error.message)); }, 30000);
    return () => window.clearInterval(timer);
  }, [canEdit, initialSale, load, busy]);
  async function run(action: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/sale-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sale, action, starts_at: new Date().toISOString(), ends_at: end ? new Date(end).toISOString() : null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update sale.');
      setSale(body.sale); setEnd(localTime(body.sale.ends_at)); setNow(Date.now()); onSaleChange?.(body.sale);
      setNotice(action === 'check' ? 'Checkout pricing verified. Sale remains off.' : action === 'save' ? 'Sale details saved.' : action === 'start' ? 'Sale is live. Forecast updated.' : 'Sale ended. Forecast uses regular pricing.');
    } catch (error) {
      setError((error as Error).message);
      try { const next = await load(); setEnd(localTime(next.ends_at)); } catch { /* Preserve the original operation error. */ }
    } finally { setBusy(false); }
  }
  if (!canEdit) return null;
  const active = isSaleActive(sale, now);
  const disabled = !loaded || busy || sale.enabled;
  return <section className="rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Website sale</h2><p className="mt-1 text-xs text-slate-500">Extra 35% after quantity savings · builder modules only</p></div><span role="status" className={active ? 'rounded-full bg-green-50 px-3 py-1 text-xs text-green-800' : 'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600'}>{!loaded ? 'Loading' : sale.status === 'error' ? 'Needs attention' : sale.status === 'syncing' ? 'Updating' : active ? 'Live' : sale.enabled ? 'Expired · end to reset' : 'Off'}</span></div>
    {error || sale.last_error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || sale.last_error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm text-green-800">{notice}</p> : null}
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-slate-500">Sale ends<input className="mt-1 block rounded-lg border border-line p-2.5 text-sm text-slate-950" type="datetime-local" value={end} disabled={disabled} onChange={event => setEnd(event.target.value)} /></label>
      {!sale.enabled ? <button disabled={disabled || !end || Date.parse(end) <= now} onClick={() => void run('start')} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Updating…' : 'Start sale now'}</button> : <button disabled={!loaded || busy} onClick={() => void run('end')} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40">{busy ? 'Updating…' : 'End sale'}</button>}
      {!sale.enabled && sale.status === 'error' ? <button disabled={!loaded || busy} onClick={() => void run('end')} className="rounded-lg border px-4 py-2.5 text-sm disabled:opacity-40">Retry cleanup</button> : null}
    </div>
    <p className="mt-2 text-xs text-slate-500">Starts when you click. Ends automatically. Times use your device’s time zone.</p>
    <details className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">Sale copy and connection</summary>
      <fieldset disabled={disabled} className="mt-3 grid gap-3">
        <label className="text-xs font-medium text-slate-500">Sale name<input className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm text-slate-950" maxLength={80} value={sale.name} onChange={event => setSale({ ...sale, name: event.target.value })} /></label>
        <label className="text-xs font-medium text-slate-500">Announcement<input className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm text-slate-950" maxLength={200} value={sale.announcement} onChange={event => setSale({ ...sale, announcement: event.target.value })} /></label>
        <label className="text-xs font-medium text-slate-500">Delivery message<input className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm text-slate-950" maxLength={200} value={sale.delivery_message} onChange={event => setSale({ ...sale, delivery_message: event.target.value })} /></label>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-3"><button disabled={disabled || !end} onClick={() => void run('save')} className="rounded-lg border px-4 py-2 text-xs font-medium disabled:opacity-40">Save details</button><button disabled={disabled} onClick={() => void run('check')} className="rounded-lg border px-4 py-2 text-xs font-medium disabled:opacity-40">Verify checkout connection</button></div>
    </details>
  </section>;
}
