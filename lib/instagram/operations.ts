import {InstagramError} from './client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {operatingStatus,type InstagramCapability,type InstagramOperatingSettings,type OperatingConnection} from './operating-controls';
export function instagramOperations(db:Pick<SupabaseClient,'from'|'rpc'>,account:string,connection:()=>Promise<OperatingConnection>,environment:()=>Record<string,string|undefined>=()=>process.env){
 async function status(){
  let settings:InstagramOperatingSettings|null=null,c:OperatingConnection=null;
  try{const r=await db.from('instagram_operating_settings').select('account_id,version,publishing,receive,send,worker_seen_at,webhook_verified_at').eq('account_id',account).maybeSingle();if(!r.error)settings=r.data as InstagramOperatingSettings|null;}catch{/* Missing migration fails closed. */}
  try{c=await connection();}catch{/* No connected account is never ready. */}
  return operatingStatus(settings,c,account,environment());
 }
 async function requireEnabled(capability:InstagramCapability){const s=await status();if(!s.enabled[capability])throw new InstagramError('instagram_operation_disabled');}
 async function change(actor:string,capability:InstagramCapability,enabled:boolean,version:number){
  const before=await status();if(!before.available||before.version!==version||enabled&&!before.readiness[capability].ready)throw Error('instagram_control_unavailable');
  const {error}=await db.rpc('set_instagram_operating_control',{p_actor:actor,p_account:account,p_capability:capability,p_enabled:enabled,p_version:version});
  if(error)throw Error('instagram_control_not_saved');return status();
 }
 async function observe(kind:'worker'|'webhook'){
  const {error}=await db.rpc('observe_instagram_operation',{p_account:account,p_kind:kind});if(error)throw Error('instagram_control_unavailable');
 }
 return {status,requireEnabled,change,observe};
}
