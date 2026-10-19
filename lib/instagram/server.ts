import 'server-only';
import {randomUUID} from 'node:crypto';
import {createAdminClient} from '../supabase/admin';
import {getUserContext} from '../auth';
import {canApproveContent} from '../content-permissions';
import {inspectOperatorEnvironment} from '../operator-environment';
import {instagramTransport} from './transport';
import {InstagramClient,InstagramError} from './client';
import {instagramConfig,openToken,sealToken,sha256,requireScopes,type ApprovedSnapshot,type InstagramConfig,type Media} from './core';
import type {ContentPost} from '../content';
import type {JobPatch,PublishJob} from './worker';
export const instagramHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
export async function instagramOwner(){const {user,profile}=await getUserContext();if(!user||!canApproveContent(profile?.role))throw Error('instagram_owner_required');return user.id;}
export function instagramServer(){
 if(!inspectOperatorEnvironment(process.env).configured)throw Error('instagram_setup_required');
 const config=instagramConfig(process.env),db=createAdminClient(),api=new InstagramClient(config,instagramTransport);
 async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await db.rpc(name,args);if(error)throw Error('instagram_storage_unavailable');return data as T;}
 async function currentPost(id:string){const {data,error}=await db.from('operator_content_posts').select('package').eq('id',id).single();if(error||!data)throw Error('instagram_post_unavailable');return data.package as ContentPost;}
 async function connection(){const {data,error}=await db.from('instagram_connections').select('*').eq('account_id',config.accountId).maybeSingle();if(error)throw Error('instagram_storage_unavailable');return data as null|{account_id:string;username:string;token_ciphertext:string;expires_at:string;refreshed_at:string;scopes:string[]};}
 async function token(){let c=await connection();if(!c||Date.parse(c.expires_at)<=Date.now())throw new InstagramError('instagram_reconnect_required');requireScopes(c.scopes);let t=openToken(c.token_ciphertext,config);
  if(Date.parse(c.expires_at)-Date.now()<7*86400000&&Date.now()-Date.parse(c.refreshed_at)>=86400000){
   // Compare-and-swap a short refresh lease; simultaneous workers must not rotate twice.
   const claimed=await rpc<boolean>('claim_instagram_refresh',{p_account:config.accountId});if(!claimed)throw new InstagramError('instagram_refresh_pending');
   try{const r=await api.refresh(t);await storeConnection({token:r.token,expiresIn:r.expiresIn,username:c.username,scopes:c.scopes});t=r.token;}finally{await db.from('instagram_connections').update({refresh_until:null}).eq('account_id',config.accountId);}
   c=await connection();if(!c)throw new InstagramError('instagram_reconnect_required');
  }return t;
 }
 async function storeConnection(c:{token:string;expiresIn:number;username:string;scopes:string[]}){const {error}=await db.from('instagram_connections').upsert({account_id:config.accountId,app_id:config.appId,username:c.username,token_ciphertext:sealToken(c.token,config),expires_at:new Date(Date.now()+c.expiresIn*1000).toISOString(),refreshed_at:new Date().toISOString(),scopes:c.scopes});if(error)throw Error('instagram_storage_unavailable');}
 async function media(id:string):Promise<Media>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('instagram_media_required');const {data,error}=await db.from('instagram_media').select('id,path,sha256,mime,width,height,size').eq('id',id).single();if(error||!data)throw Error('instagram_media_required');return data as Media;}
 async function pinnedMedia(s:ApprovedSnapshot){const m=await media(s.media.id);if(m.path!==s.media.path||m.sha256!==s.media.sha256)throw new InstagramError('instagram_media_changed');
  const {data,error}=await db.storage.from('instagram-media').download(m.path);if(error||!data)throw new InstagramError('instagram_media_unavailable');const bytes=Buffer.from(await data.arrayBuffer());if(sha256(bytes)!==s.media.sha256)throw new InstagramError('instagram_media_changed');
  const signed=await db.storage.from('instagram-media').createSignedUrl(m.path,86400);if(signed.error||!signed.data)throw new InstagramError('instagram_media_unavailable');return {bytes,url:signed.data.signedUrl};
 }
 return {config,db,api,rpc,currentPost,connection,token,storeConnection,media,pinnedMedia};
}
export function jobPorts(s:ReturnType<typeof instagramServer>){let claimed:PublishJob|null=null;return {ports:{
 claim:async()=>{claimed=await s.rpc<PublishJob|null>('claim_instagram_publish_job',{p_account:s.config.accountId,p_lease:randomUUID()});return claimed;},
 save:async(j:PublishJob,p:JobPatch)=>{await s.rpc('save_instagram_publish_job',{p_id:j.id,p_lease:j.lease_id,p_patch:p});},
 begin:async(j:PublishJob)=>{await s.rpc('begin_instagram_publish_job',{p_id:j.id,p_lease:j.lease_id});},
 post:s.currentPost,token:s.token,media:s.pinnedMedia,api:s.api},release:async()=>{if(claimed)await s.rpc('release_instagram_publish_job',{p_id:claimed.id,p_lease:claimed.lease_id});}};
}
export function configuredInstagramMetadata(c:InstagramConfig){return {configured:true,accountId:c.accountId,messagesSendingEnabled:process.env.INSTAGRAM_OUTBOUND_MESSAGES_ENABLED==='1',publishingEnabled:process.env.INSTAGRAM_PUBLISHING_ENABLED==='1'};}
