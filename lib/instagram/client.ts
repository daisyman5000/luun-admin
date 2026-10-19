import {type InstagramConfig,requireScopes} from './core';
import type {OAuthStage} from './oauth-diagnostics';
export class InstagramError extends Error{constructor(public code:string,public uncertain=false){super(code);}}
export class InstagramClient{
 constructor(private c:InstagramConfig,private send:typeof fetch=fetch){}
 private async request(url:URL,init:RequestInit={},mutating=false){
  let r:Response;try{r=await this.send(url,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new InstagramError('instagram_network_unavailable',mutating);}
  if(!r.ok)throw new InstagramError(r.status===429?'instagram_rate_limited':r.status===401||r.status===403?'instagram_reconnect_required':'instagram_request_rejected',mutating&&(r.status>=500||r.status===408||r.status>=300&&r.status<400));
  try{return await r.json();}catch{throw new InstagramError('instagram_response_unconfirmed',mutating);}
 }
 private graph(path:string){return new URL('https://graph.instagram.com/'+this.c.apiVersion+'/'+path);}
 async exchange(code:string,onStage?:(stage:OAuthStage)=>void){
  onStage?.('short_token');
  const short=await this.request(new URL('https://api.instagram.com/oauth/access_token'),{method:'POST',body:new URLSearchParams({client_id:this.c.appId,client_secret:this.c.appSecret,grant_type:'authorization_code',redirect_uri:this.c.redirectUri,code})});
  const t=Array.isArray(short?.data)?short.data[0]:short;
  if(!t||typeof t!=='object'||typeof t.access_token!=='string'||!['string','number'].includes(typeof t.user_id))throw new InstagramError('instagram_response_unconfirmed');
  onStage?.('permissions');
  const scopes=Array.isArray(t.permissions)?t.permissions:typeof t.permissions==='string'?t.permissions.split(','):[];requireScopes(scopes);
  onStage?.('account_match');
  if(String(t.user_id)!==this.c.accountId||typeof t.access_token!=='string')throw new InstagramError('instagram_account_mismatch');
  onStage?.('long_token');
  const u=new URL('https://graph.instagram.com/access_token');u.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:this.c.appSecret,access_token:t.access_token}).toString();
  const long=await this.request(u);if(!long||typeof long.access_token!=='string'||!Number.isFinite(long.expires_in)||long.expires_in<=0)throw new InstagramError('instagram_token_unconfirmed');
  onStage?.('profile');
  const me=await this.profile(long.access_token);return {token:long.access_token as string,expiresIn:Number(long.expires_in),scopes,username:me.username};
 }
 async profile(token:string){const u=this.graph('me');u.searchParams.set('fields','user_id,username');const me=await this.request(u,{headers:{Authorization:'Bearer '+token}});if(String(me.user_id)!==this.c.accountId||typeof me.username!=='string')throw new InstagramError('instagram_account_mismatch');return {username:me.username as string};}
 async refresh(token:string){const u=new URL('https://graph.instagram.com/refresh_access_token');u.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}).toString();const r=await this.request(u);if(typeof r.access_token!=='string'||!Number.isFinite(r.expires_in)||r.expires_in<=0)throw new InstagramError('instagram_token_unconfirmed');return {token:r.access_token as string,expiresIn:Number(r.expires_in)};}
 async create(token:string,imageUrl:string,caption:string){const r=await this.request(this.graph(this.c.accountId+'/media'),{method:'POST',headers:{Authorization:'Bearer '+token},body:new URLSearchParams({image_url:imageUrl,caption})},true);if(!r.id)throw new InstagramError('instagram_creation_unconfirmed',true);return String(r.id);}
 async status(token:string,id:string){const u=this.graph(encodeURIComponent(id));u.searchParams.set('fields','status_code');const r=await this.request(u,{headers:{Authorization:'Bearer '+token}});if(!['FINISHED','IN_PROGRESS','PUBLISHED','ERROR','EXPIRED'].includes(r.status_code))throw new InstagramError('instagram_status_unconfirmed');return r.status_code as string;}
 async publish(token:string,id:string){const r=await this.request(this.graph(this.c.accountId+'/media_publish'),{method:'POST',headers:{Authorization:'Bearer '+token},body:new URLSearchParams({creation_id:id})},true);if(!r.id)throw new InstagramError('instagram_publication_unconfirmed',true);return String(r.id);}
 async sendReply(token:string,peer:string,text:string){if(!/^\d{1,40}$/.test(peer)||!text.trim()||text.length>1000)throw new InstagramError('instagram_reply_invalid');const r=await this.request(this.graph(this.c.accountId+'/messages'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:peer},message:{text}})},true);if(typeof r.message_id!=='string'||String(r.recipient_id)!==peer)throw new InstagramError('instagram_reply_unconfirmed',true);return r.message_id as string;}
 async permalink(token:string,id:string){const u=this.graph(encodeURIComponent(id));u.searchParams.set('fields','permalink');const r=await this.request(u,{headers:{Authorization:'Bearer '+token}});if(typeof r.permalink!=='string'||!/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(r.permalink))return null;return r.permalink as string;}
}
