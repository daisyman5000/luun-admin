"use client";
import {useEffect,useState} from 'react';
import {DEFAULT_SALE,type SaleState} from '@/lib/sales/types';
import {CHECK_CONFIGS,quote} from '@/lib/sales/pricing';
const money=(cents:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100);
const localTime=(value:string|null)=>value?new Date(Date.parse(value)-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
export function DemandSaleControl({canEdit}:{canEdit:boolean}){
 const [testActive,setTestActive]=useState(false);
 const [sale,setSale]=useState<SaleState>(DEFAULT_SALE);
 const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [start,setStart]=useState(localTime(new Date().toISOString()));
 const [end,setEnd]=useState('');
 async function load(){const r=await fetch('/api/sale-control',{cache:'no-store'});const b=await r.json().catch(()=>({error:'Sale controls are not configured yet.'}));if(!r.ok)throw new Error(b.error);setSale(b.sale);setStart(localTime(b.sale.starts_at)||localTime(new Date().toISOString()));setEnd(localTime(b.sale.ends_at));setLoaded(true);}
 useEffect(()=>{if(canEdit)void load().catch(e=>setError(e.message));},[canEdit]);
 if(!canEdit)return null;
 async function run(action:string){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/sale-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...sale,action,starts_at:start?new Date(start).toISOString():null,ends_at:end?new Date(end).toISOString():null})});
   const body=await r.json();if(!r.ok)throw new Error(body.error);
   setSale(body.sale);
  }catch(e){setError((e as Error).message);try{await load();}catch{}}
  finally{setBusy(false);}
 }
 const disabled=busy || sale.enabled;
 return <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Website sale</h2><p className="mt-1 text-sm text-slate-500">An additional 35% off after existing module quantity savings.</p></div><span role="status" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{!loaded?'Setup required':sale.status==='ready'&&sale.enabled?'Sale enabled':sale.status==='off'?'Sale off':sale.status==='error'?'Needs attention':'Updating'}</span></div>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {sale.last_error&&<p className="mt-3 text-sm text-red-800">{sale.last_error}</p>}
  <fieldset disabled={disabled} className="mt-5 grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-medium">Sale name<input className="mt-1 w-full rounded-xl border p-3" maxLength={80} value={sale.name} onChange={e=>setSale({...sale,name:e.target.value})}/></label>
   <label className="text-sm font-medium">Additional discount<input className="mt-1 w-full rounded-xl border bg-slate-50 p-3" value="35%" readOnly/></label>
   <label className="text-sm font-medium">Start time<input className="mt-1 w-full rounded-xl border p-3" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label className="text-sm font-medium">End time<input className="mt-1 w-full rounded-xl border p-3" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label className="text-sm font-medium sm:col-span-2">Announcement<input className="mt-1 w-full rounded-xl border p-3" maxLength={200} value={sale.announcement} onChange={e=>setSale({...sale,announcement:e.target.value})}/></label>
   <label className="text-sm font-medium sm:col-span-2">Delivery message<input className="mt-1 w-full rounded-xl border p-3" maxLength={200} value={sale.delivery_message} onChange={e=>setSale({...sale,delivery_message:e.target.value})}/></label>
  </fieldset>
  <p className="mt-3 text-xs text-slate-500">Times use your device’s time zone. Start manually at the chosen time; the sale expires automatically at the end time. The demand forecast calendar does not activate website promotions.</p>
  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Test preview: {testActive?'sale on':'sale off'}</p><p className="mt-1 text-sm text-slate-600">This test changes only the estimates below. It does not change luun.ca or Shopify checkout.</p></div><button type="button" role="switch" aria-checked={testActive} aria-label="Test extra 35 percent sale" onClick={()=>setTestActive(!testActive)} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">{testActive?'Turn test off':'Turn test on'}</button></div><p className="mt-3 text-sm">{testActive?sale.announcement:'Regular pricing — quantity savings still apply.'}</p></div>
  <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-semibold">Checkout estimates before shipping and tax</caption><thead><tr><th className="py-2">Modules</th><th>Quantity savings</th><th>Regular</th><th>With extra 35%</th><th>Test preview</th></tr></thead><tbody>{CHECK_CONFIGS.map(c=>{const p=quote(c,true);return <tr key={p.pieces} className="border-t"><td className="py-3">{c.corner} corner / {c.armless} armless / {c.ottoman} ottoman</td><td>{Math.round(p.quantityRate*100)}%</td><td>{money(p.regularCents)}</td><td className="font-semibold">{money(p.saleCents)}</td><td className="font-semibold text-blue-700">{money(testActive?p.saleCents:p.regularCents)}</td></tr>;})}</tbody></table></div>
  <div className="mt-5 flex flex-wrap gap-3"><button disabled={!loaded||disabled} onClick={()=>void run('save')} className="rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-40">Save details</button><button disabled={!loaded||disabled} onClick={()=>void run('start')} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?'Updating…':'Start sale'}</button><button disabled={!loaded||busy||(!sale.enabled&&!sale.shopify_discount_id&&sale.status!=='syncing')} onClick={()=>void run('end')} className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-40">End sale</button></div>
  <p className="mt-3 text-xs text-slate-500">Start sale verifies Shopify checkout totals before enabling website sale prices. Failed checks leave the sale unavailable.</p>
 </section>;
}
