import {type InstagramConfig,requireScopes,INSTAGRAM_APPROVED_ACCOUNT_ID} from './core';
import type {OAuthStage} from './oauth-diagnostics';
import {instagramProviderJSON} from './provider-json';
export class InstagramError extends Error{constructor(public code:string,public uncertain=false){super(code);}}
function identifier(value:unknown){
 if(typeof value==='string'&&/^[1-9]\d{0,39}$/.test(value))return value;
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return String(value);
 throw new InstagramError('instagram_identifier_invalid');
}
function singleRecord(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new InstagramError('instagram_response_unconfirmed');
 const raw=value as Record<string,unknown>;
 if('data' in raw){if(!Array.isArray(raw.data)||raw.data.length!==1||['id','user_id','username','access_token'].some(key=>key in raw))throw new InstagramError('instagram_response_unconfirmed');const item=raw.data[0];if(!item||typeof item!=='object'||Array.isArray(item)||'data' in item)throw new InstagramError('instagram_response_unconfirmed');return item as Record<string,unknown>;}
 return raw;
}
function bearerType(record:Record<string,unknown>){return record.token_type===undefined||(typeof record.token_type==='string'&&record.token_type.toLowerCase()==='bearer');}
function tokenResult(value:unknown){const r=singleRecord(value);if(typeof r.access_token!=='string'||!r.access_token||!bearerType(r)||typeof r.expires_in!=='number'||!Number.isSafeInteger(r.expires_in)||r.expires_in<=0||!Number.isFinite(new Date(Date.now()+r.expires_in*1000).getTime()))throw new InstagramError('instagram_token_unconfirmed');return {token:r.access_token,expiresIn:r.expires_in};}
export class InstagramClient{
 constructor(private c:InstagramConfig,private send:typeof fetch=fetch){}
 private async request(url:URL,init:RequestInit={},mutating=false){
  let r:Response;try{r=await this.send(url,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new InstagramError('instagram_network_unavailable',mutating);}
  if(!r.ok)throw new InstagramError(r.status===429?'instagram_rate_limited':r.status===401||r.status===403?'instagram_reconnect_required':'instagram_request_rejected',mutating&&(r.status>=500||r.status===408||r.status>=300&&r.status<400));
  try{return instagramProviderJSON(await r.text());}catch{throw new InstagramError('instagram_response_unconfirmed',mutating);}
 }
 private graph(path:string){return new URL('https://graph.instagram.com/'+this.c.apiVersion+'/'+path);}
 async exchange(code:string,onStage?:(stage:OAuthStage)=>void){
  onStage?.('short_token');
  const short=await this.request(new URL('https://api.instagram.com/oauth/access_token'),{method:'POST',body:new URLSearchParams({client_id:this.c.appId,client_secret:this.c.appSecret,grant_type:'authorization_code',redirect_uri:this.c.redirectUri,code})});
  const t=singleRecord(short);
  if(typeof t.access_token!=='string'||!t.access_token||!bearerType(t))throw new InstagramError('instagram_response_unconfirmed');
  const scopedId=identifier(t.user_id);
  onStage?.('permissions');
  const permissions=Array.isArray(t.permissions)?t.permissions:typeof t.permissions==='string'?t.permissions.split(','):[];
  const scopes=permissions.map(p=>typeof p==='string'?p.trim():'');requireScopes(scopes);
  // OAuth user_id and /me.id are app-scoped; /me.user_id is the professional account.
  // Resolve the token-bound professional account before exchanging or storing a long token.
  onStage?.('profile');
  const shortProfile=await this.profile(t.access_token);
  onStage?.('account_match');
  if(shortProfile.scopedId!==scopedId)throw new InstagramError('instagram_account_mismatch');
  onStage?.('long_token');
  const u=new URL('https://graph.instagram.com/access_token');u.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:this.c.appSecret,access_token:t.access_token}).toString();
  const long=tokenResult(await this.request(u));
  onStage?.('profile');
  const me=await this.profile(long.token);
  onStage?.('account_match');
  if(me.scopedId!==shortProfile.scopedId||me.accountId!==shortProfile.accountId)throw new InstagramError('instagram_account_mismatch');
  return {...long,scopes,username:me.username,accountId:me.accountId,scopedId:me.scopedId};
 }
 async profile(token:string){
  const u=this.graph('me');u.searchParams.set('fields','id,user_id,username');
  const me=singleRecord(await this.request(u,{headers:{Authorization:'Bearer '+token}}));
  if(this.c.accountId!==INSTAGRAM_APPROVED_ACCOUNT_ID)throw new InstagramError('instagram_configured_account_mismatch');
  if(me.user_id===undefined||me.user_id===null||me.user_id==='')throw new InstagramError('instagram_professional_id_missing');
  let accountId:string;
  try{accountId=identifier(me.user_id);}catch{throw new InstagramError('instagram_professional_id_invalid');}
  if(accountId!==this.c.accountId)throw new InstagramError('instagram_professional_account_mismatch');
  if(typeof me.username!=='string'||!me.username.trim())throw new InstagramError('instagram_profile_username_missing');
  const scopedId=identifier(me.id);
  return {username:me.username,accountId,scopedId};
 }
 async refresh(token:string){const u=new URL('https://graph.instagram.com/refresh_access_token');u.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}).toString();return tokenResult(await this.request(u));}
 async mediaEngagement(token:string,id:string){const u=this.graph(encodeURIComponent(identifier(id)));u.searchParams.set('fields','id,like_count,comments_count');const r=singleRecord(await this.request(u,{headers:{Authorization:'Bearer '+token}}));if(identifier(r.id)!==id)throw new InstagramError('instagram_account_mismatch');return r;}
 async mediaInsights(token:string,id:string,metric:string){if(!['reach','saved','shares','views'].includes(metric))throw new InstagramError('instagram_metric_invalid');const u=this.graph(encodeURIComponent(identifier(id))+'/insights');u.searchParams.set('metric',metric);return this.request(u,{headers:{Authorization:'Bearer '+token}});}
 async create(token:string,imageUrl:string,caption:string){const r=await this.request(this.graph(this.c.accountId+'/media'),{method:'POST',headers:{Authorization:'Bearer '+token},body:new URLSearchParams({image_url:imageUrl,caption})},true);if(!r.id)throw new InstagramError('instagram_creation_unconfirmed',true);return String(r.id);}
 async status(token:string,id:string){const u=this.graph(encodeURIComponent(id));u.searchParams.set('fields','status_code');const r=await this.request(u,{headers:{Authorization:'Bearer '+token}});if(typeof r.status_code!=='string'||!['FINISHED','IN_PROGRESS','PUBLISHED','ERROR','EXPIRED'].includes(r.status_code))throw new InstagramError('instagram_status_unconfirmed');return r.status_code as string;}
 async publish(token:string,id:string){const r=await this.request(this.graph(this.c.accountId+'/media_publish'),{method:'POST',headers:{Authorization:'Bearer '+token},body:new URLSearchParams({creation_id:id})},true);if(!r.id)throw new InstagramError('instagram_publication_unconfirmed',true);return String(r.id);}
 async sendReply(token:string,peer:string,text:string){if(!/^\d{1,40}$/.test(peer)||!text.trim()||text.length>1000)throw new InstagramError('instagram_reply_invalid');const r=await this.request(this.graph(this.c.accountId+'/messages'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:peer},message:{text}})},true);if(typeof r.message_id!=='string'||String(r.recipient_id)!==peer)throw new InstagramError('instagram_reply_unconfirmed',true);return r.message_id as string;}
 async permalink(token:string,id:string){const u=this.graph(encodeURIComponent(id));u.searchParams.set('fields','permalink');const r=await this.request(u,{headers:{Authorization:'Bearer '+token}});if(typeof r.permalink!=='string'||!/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(r.permalink))return null;return r.permalink as string;}
}
