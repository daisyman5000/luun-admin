'use client';
import {useState} from 'react';
import {instagramCapabilities,type InstagramCapability,type InstagramOperatingStatus} from '@/lib/instagram/operating-controls';
const labels={publishing:'Publishing',receive:'Receive messages',send:'Send approved replies'};
export function InstagramOperatingControls({operations,local,onChange}:{operations:InstagramOperatingStatus|undefined;local:boolean;onChange:(s:InstagramOperatingStatus)=>void}){
 const [busy,setBusy]=useState<InstagramCapability|null>(null),[error,setError]=useState('');
 async function change(capability:InstagramCapability){
  if(!operations)return;setBusy(capability);setError('');
  try{const r=await fetch('/api/instagram/controls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({capability,enabled:!operations.requested[capability],version:operations.version})}),body=await r.json();if(!r.ok)throw Error(body.error||'Control was not saved.');onChange(body.operations);}
  catch(e){setError(e instanceof Error?e.message:'Control was not saved.');}finally{setBusy(null);}
 }
 async function refresh(){setError('');try{const r=await fetch('/api/instagram/status',{cache:'no-store'}),body=await r.json();if(!r.ok||!body.operations)throw Error();onChange(body.operations);}catch{setError('Readiness could not be refreshed.');}}
 if(!operations)return <p className="mt-3 text-xs">Operational controls unavailable. All actions stay off until readiness can be checked.</p>;
 return <section className="mt-4 border-t border-amber-200 pt-3" aria-label="Instagram operating controls">
  <div className="mb-3 flex items-center justify-between"><strong>Instagram controls</strong><a href="/ticketing?view=instagram" className="underline">Open inbox</a><button type="button" disabled={local||busy!==null} onClick={()=>void refresh()} className="rounded border border-amber-300 px-3 py-1 text-xs disabled:opacity-50">Refresh status</button></div>
  <div className="grid gap-3 sm:grid-cols-3">{instagramCapabilities.map(capability=>{
   const requested=operations.requested[capability],enabled=operations.enabled[capability],readiness=operations.readiness[capability];
   return <div key={capability} className="rounded-lg border border-amber-200 p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{labels[capability]}</span><button type="button" role="switch" aria-checked={requested} aria-label={labels[capability]} disabled={local||busy!==null||!operations.available||!requested&&!readiness.ready} onClick={()=>void change(capability)} className="rounded border border-amber-400 px-3 py-1 text-xs disabled:opacity-50">{busy===capability?'Saving…':enabled?'On':requested?'Blocked':'Off'}</button></div><p className="mt-2 text-xs">{readiness.blockers.length?readiness.blockers.join(' '):capability==='publishing'?'Publish now requires your deliberate click and saved approval.':capability==='send'?'Saved approval and deliberate Send required.':'Ready to accept signed webhook events.'}</p></div>;
  })}</div>
  <p className="mt-3 text-xs">No automatic replies. Meta account subscription is not verified here. Turning off stops new actions; an action already sent cannot be recalled.</p>
  <p className="mt-1 text-xs">Future scheduling: {operations.scheduledPublishingReady?'ready':'unavailable'}. Scheduler last checked in: {operations.workerLastSeen?new Date(operations.workerLastSeen).toLocaleString():'never'}. Webhook challenge: {operations.callbackVerifiedAt?new Date(operations.callbackVerifiedAt).toLocaleString():'not verified'}.</p>
  {error&&<p role="alert" className="mt-2 text-xs">{error}</p>}
 </section>;
}
