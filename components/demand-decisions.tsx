'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePlan, type PlanInput, type PlanningSettings } from '@/lib/demand-plan';
const fields: { key: keyof PlanningSettings; label: string; min: number; max: number }[] = [
 { key:'leadDays',label:'Container lead time (days)',min:1,max:730 },
 { key:'bufferDays',label:'Stock buffer (days)',min:0,max:180 },
 { key:'costPerPaidOrder',label:'Cost per additional paid order (CAD)',min:0.01,max:10000 },
 { key:'organicOrders',label:'Orders/day without advertising',min:0,max:10000 },
 { key:'saleLift',label:'Measured sale pace multiplier (1 = no increase)',min:1,max:20 },
 { key:'maxBudget',label:'Maximum daily ad spend (CAD)',min:0,max:5000 }
];
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Vancouver'}).format(new Date(value)) : '—';
export function DemandDecisions({ input, canEdit, initialError }: { input: PlanInput; canEdit: boolean; initialError: string | null }) {
 const router = useRouter();
 useEffect(() => { const timer = window.setInterval(() => router.refresh(), 300000); return () => window.clearInterval(timer); }, [router]);
 const [saved,setSaved] = useState(input.settings);
 const [draft,setDraft] = useState(input.settings);
 const [error,setError] = useState(initialError || '');
 const [busy,setBusy] = useState(false);
 const [notice,setNotice] = useState('');
 const plan = calculatePlan({ ...input,settings:saved });
 async function save() {
  setBusy(true);setError('');setNotice('');
  try { const response=await fetch('/api/demand-planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});const body=await response.json();if(!response.ok)throw new Error(body.error);setSaved(body.settings);setNotice('Settings saved. Recommendations updated.'); }
  catch(e){setError(e instanceof Error ? e.message : 'Unable to save.');}finally{setBusy(false);}
 }
 const overdue = plan.orderDate && Date.parse(plan.orderDate) <= input.now;
 return <section aria-label="Daily decisions" className="rounded-2xl border border-line bg-white p-5">
  <h2 className="font-semibold">Your plan</h2>
  <div className="mt-4 grid gap-4 sm:grid-cols-3">
   <div><p className="text-sm text-slate-500">Daily ad spend</p><p className="mt-2 text-2xl font-semibold">{plan.budget === null ? '—' : new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(plan.budget)}</p></div>
   <div><p className="text-sm text-slate-500">Sale start → end</p><p className="mt-2 text-lg font-semibold">{plan.saleStart ? `${date(plan.saleStart)} → ${date(plan.saleEnd)}` : '—'}</p></div>
   <div><p className="text-sm text-slate-500">Order next container by</p><p className="mt-2 text-lg font-semibold">{date(plan.orderDate)}{overdue ? ' · order due now' : ''}</p></div>
  </div>
  <p className="mt-4 text-sm text-slate-600">{plan.reason}</p>
  {plan.limiting ? <p className="mt-1 text-xs text-slate-500">First stock constraint: {plan.limiting.replace(':',' · ')}.</p> : null}
  <p className="mt-2 text-xs text-slate-500">Refreshes connected data every five minutes. Container deadline follows the recommended pace when inputs are available; otherwise it uses observed sales. Recommendations do not change ads, activate a sale or place a purchase order.</p>
  <details className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Planning settings</summary>
   <p className="mt-2 text-xs text-slate-500">Enter verified operating values. Leave unknown values empty. Acquisition cost and sale uplift must come from measured results; bank payments cannot establish them.</p>
   <fieldset disabled={!canEdit || busy} className="mt-3 grid gap-3 sm:grid-cols-2">{fields.map(field=><label key={field.key} className="text-xs text-slate-600">{field.label}<input type="number" min={field.min} max={field.max} step="any" value={draft[field.key] ?? ''} onChange={e=>setDraft({...draft,[field.key]:e.target.value===''?null:Number(e.target.value)})} className="mt-1 block w-full rounded-lg border border-line p-2 text-sm" /></label>)}</fieldset>
   {canEdit ? <button disabled={busy} onClick={()=>void save()} className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm text-white disabled:opacity-40">{busy?'Saving…':'Save settings'}</button> : null}
  </details>
  {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  {notice ? <p role="status" className="mt-3 text-sm text-green-700">{notice}</p> : null}
 </section>;
}
