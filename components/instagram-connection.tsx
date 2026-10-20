'use client';
import {useEffect,useState} from 'react';
import {InstagramOperatingControls} from './instagram-operating-controls';
import type {InstagramOperatingStatus} from '@/lib/instagram/operating-controls';
import type {OAuthFailure} from '@/lib/instagram/oauth-diagnostics';
export type InstagramConnectionState={configured:boolean;connected:boolean;username?:string;publishingEnabled?:boolean;messagesSendingEnabled?:boolean;setupIssues?:string[];callbackFailure?:OAuthFailure|null;operations?:InstagramOperatingStatus};
export function InstagramConnection({local,onState}:{local:boolean;onState:(s:InstagramConnectionState)=>void}){
 const [state,setState]=useState<InstagramConnectionState>({configured:false,connected:false}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(local)return;const failed=new URL(window.location.href).searchParams.get('instagram')==='failed';let live=true;fetch('/api/instagram/status',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(s=>{if(live){setState(s);onState(s);setError(s.connected?'':failed?'Connection failed. Try Connect Instagram again.':'');}}).catch(()=>{if(live)setError('Owner/admin sign-in or Instagram setup is required.');});return()=>{live=false;};},[local,onState]);
 async function connect(){setBusy(true);setError('');try{const r=await fetch('/api/instagram/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),b=await r.json();if(!r.ok)throw Error(b.error);const url=new URL(b.authorizeUrl);if(url.origin!=='https://www.instagram.com'||url.pathname!=='/oauth/authorize')throw Error('Invalid connection destination.');window.location.assign(url.toString());}catch(e){setError(e instanceof Error?e.message:'Connection unavailable.');setBusy(false);}}
 return <details className="mt-5 text-sm text-slate-500"><summary className="w-fit cursor-pointer">Settings</summary><div className="mt-3 flex flex-wrap items-center gap-3">
  <span>{state.connected?'@'+state.username:'Instagram not connected'}</span>
  {!state.connected&&<button type="button" disabled={local||!state.configured||busy} onClick={()=>void connect()} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">{busy?'Opening…':'Connect Instagram'}</button>}
  <InstagramOperatingControls compact operations={state.operations} local={local} onChange={operations=>{const next={...state,operations,publishingEnabled:operations.enabled.publishing,messagesSendingEnabled:operations.enabled.send};setState(next);onState(next);}}/>
  {error&&<p role="alert" className="text-xs text-red-800">{error}</p>}
 </div></details>;
}
