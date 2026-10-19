import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import type {ContentPost} from '../content';
export const INSTAGRAM_SCOPES=['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_messages'] as const;
export const INSTAGRAM_CALLBACK='https://luun-admin-et42.vercel.app/api/instagram/callback';
export const INSTAGRAM_APPROVED_ACCOUNT_ID='1784147235520052';
export type InstagramConfig={appId:string;appSecret:string;redirectUri:string;key:string;apiVersion:string;accountId:string};
export function instagramSetupIssues(env:Record<string,string|undefined>){
 const issues:string[]=[];
 if(env.INSTAGRAM_CONNECTION_ENABLED!=='1')issues.push('INSTAGRAM_CONNECTION_ENABLED (disabled)');
 for(const name of ['INSTAGRAM_APP_SECRET','INSTAGRAM_TOKEN_ENCRYPTION_KEY','INSTAGRAM_GRAPH_API_VERSION'])if(!env[name])issues.push(name+' (missing)');
 if(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY&&!validKey(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY))issues.push('INSTAGRAM_TOKEN_ENCRYPTION_KEY (invalid format)');
 if(env.INSTAGRAM_GRAPH_API_VERSION&&!/^v\d+\.\d+$/.test(env.INSTAGRAM_GRAPH_API_VERSION))issues.push('INSTAGRAM_GRAPH_API_VERSION (invalid format)');
 for(const name of ['INSTAGRAM_APP_ID','INSTAGRAM_ACCOUNT_ID'])if(env[name]&&!/^\d+$/.test(env[name]))issues.push(name+' (invalid format)');
 if(env.INSTAGRAM_ACCOUNT_ID&&/^\d+$/.test(env.INSTAGRAM_ACCOUNT_ID)&&env.INSTAGRAM_ACCOUNT_ID!==INSTAGRAM_APPROVED_ACCOUNT_ID)issues.push('INSTAGRAM_ACCOUNT_ID (does not match approved account)');
 try{const u=new URL(env.INSTAGRAM_REDIRECT_URI||INSTAGRAM_CALLBACK);if(u.protocol!=='https:'||u.pathname!=='/api/instagram/callback'||u.search||u.hash||u.username||u.password)throw Error();}catch{issues.push('INSTAGRAM_REDIRECT_URI (invalid format)');}
 return issues;
}
export function instagramConfig(env:Record<string,string|undefined>):InstagramConfig{
 if(instagramSetupIssues(env).length)throw Error('instagram_setup_required');
 const c={appId:env.INSTAGRAM_APP_ID||'1820435792490081',appSecret:env.INSTAGRAM_APP_SECRET||'',redirectUri:env.INSTAGRAM_REDIRECT_URI||INSTAGRAM_CALLBACK,key:env.INSTAGRAM_TOKEN_ENCRYPTION_KEY||'',apiVersion:env.INSTAGRAM_GRAPH_API_VERSION||'',accountId:env.INSTAGRAM_ACCOUNT_ID||INSTAGRAM_APPROVED_ACCOUNT_ID};
 const u=new URL(c.redirectUri);if(u.protocol!=='https:'||u.pathname!=='/api/instagram/callback'||u.search||u.hash||u.username||u.password||!/^\d+$/.test(c.appId)||!/^\d+$/.test(c.accountId)||!c.appSecret||!/^v\d+\.\d+$/.test(c.apiVersion)||!validKey(c.key))throw Error('instagram_setup_required');return c;
}
function validKey(key:string){return /^[A-Za-z0-9+/]{43}=$/.test(key)&&Buffer.from(key,'base64').length===32;}
export function sealToken(token:string,c:InstagramConfig){if(!validKey(c.key)||!token)throw Error('instagram_token_invalid');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(c.key,'base64'),iv);cipher.setAAD(Buffer.from(c.appId+':'+c.accountId));const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');}
export function openToken(value:string,c:InstagramConfig){try{const [v,iv,tag,data,...extra]=value.split('.');if(v!=='v1'||extra.length||!validKey(c.key))throw Error();const decipher=createDecipheriv('aes-256-gcm',Buffer.from(c.key,'base64'),Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from(c.appId+':'+c.accountId));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}catch{throw Error('instagram_token_unavailable');}}
export const sha256=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
export function newOAuthState(){return randomBytes(32).toString('hex');}
export function validOAuthState(returned:string|null,cookie:string|undefined){return !!returned&&!!cookie&&/^[a-f0-9]{64}$/.test(returned)&&/^[a-f0-9]{64}$/.test(cookie)&&timingSafeEqual(Buffer.from(returned),Buffer.from(cookie));}
export async function consumeOAuthCallback(params:URLSearchParams,cookie:string|undefined,actor:string,consume:(hash:string,actor:string)=>Promise<boolean>){
 const names=[...params.keys()];if(!actor||new Set(names).size!==names.length||!validOAuthState(params.get('state'),cookie))throw Error('instagram_state_invalid');
 if(!await consume(sha256(params.get('state')!),actor))throw Error('instagram_state_unavailable');
 if(params.has('error'))throw Error('instagram_authorization_denied');
 if(!params.get('code')||params.get('code')!.length>4096)throw Error('instagram_code_invalid');return params.get('code')!;
}
export function authorizeUrl(c:InstagramConfig,state:string){if(!/^[a-f0-9]{64}$/.test(state))throw Error('instagram_state_invalid');const u=new URL('https://www.instagram.com/oauth/authorize');u.search=new URLSearchParams({client_id:c.appId,redirect_uri:c.redirectUri,response_type:'code',scope:INSTAGRAM_SCOPES.join(','),state,enable_fb_login:'0',force_authentication:'1'}).toString();return u.toString();}
export function requireScopes(scopes:string[]){if(INSTAGRAM_SCOPES.some(s=>!scopes.includes(s))||scopes.some(s=>!INSTAGRAM_SCOPES.includes(s as typeof INSTAGRAM_SCOPES[number])))throw Error('instagram_permissions_incomplete');}
export type Media={id:string;path:string;sha256:string;mime:'image/jpeg';width:number;height:number;size:number};
export type ApprovedSnapshot={accountId:string;postId:string;postVersion:number;caption:string;scheduledAt:string;media:Media};
export function publicationSnapshot(post:ContentPost,media:Media,accountId:string,now=Date.now()):ApprovedSnapshot{
 if(!['approved','planned'].includes(post.status)||!post.approvedAt||!post.caption||!post.plannedAt||Date.parse(post.plannedAt)<=now||!/^\d+$/.test(accountId)||post.assetReference!=='instagram-media:'+media.id||!/^[a-f0-9]{64}$/.test(media.sha256)||media.mime!=='image/jpeg')throw Error('instagram_approval_required');
 return {accountId,postId:post.id,postVersion:post.version,caption:post.caption,scheduledAt:new Date(post.plannedAt).toISOString(),media};
}
export const snapshotHash=(s:ApprovedSnapshot)=>sha256(JSON.stringify([s.accountId,s.postId,s.postVersion,s.caption,s.scheduledAt,s.media.id,s.media.sha256,s.media.path]));
export function snapshotStillApproved(post:ContentPost,s:ApprovedSnapshot){return post.id===s.postId&&post.version===s.postVersion&&!!post.approvedAt&&['approved','planned'].includes(post.status)&&post.caption===s.caption&&!!post.plannedAt&&new Date(post.plannedAt).toISOString()===s.scheduledAt&&post.assetReference==='instagram-media:'+s.media.id;}
export function inspectJpeg(bytes:Buffer){
 if(bytes.length>8*1024*1024||bytes.length<12||bytes[0]!==255||bytes[1]!==216)throw Error('instagram_jpeg_required');
 let offset=2;while(offset+8<bytes.length){if(bytes[offset++]!==255)throw Error('instagram_jpeg_required');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break;if([192,193,194].includes(marker)){const height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5),ratio=width/height;if(width<320||width>1440||height<1||ratio<.8||ratio>1.91)throw Error('instagram_image_dimensions');return {width,height};}offset+=length;}throw Error('instagram_jpeg_required');
}
export type DeliveryStatus='Draft'|'Scheduled'|'Published'|'Failed';
export type JobState='queued'|'creating'|'processing'|'publishing'|'reconciling'|'published'|'failed'|'cancelled';
export function deliveryStatus(state?:JobState):DeliveryStatus{return state==='published'?'Published':state==='failed'?'Failed':state&&state!=='cancelled'?'Scheduled':'Draft';}
