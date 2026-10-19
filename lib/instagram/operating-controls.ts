export const instagramCapabilities=['publishing','receive','send'] as const;
export type InstagramCapability=typeof instagramCapabilities[number];
export type InstagramOperatingSettings={account_id:string;version:number;publishing:boolean;receive:boolean;send:boolean;worker_seen_at:string|null;webhook_verified_at:string|null};
export type InstagramOperatingStatus={available:boolean;version:number;requested:Record<InstagramCapability,boolean>;enabled:Record<InstagramCapability,boolean>;readiness:Record<InstagramCapability,{ready:boolean;blockers:string[]}>;workerLastSeen:string|null;callbackVerifiedAt:string|null;subscriptionStatus:'not_verified'};
export type OperatingConnection={account_id:string;expires_at:string;scopes:string[]}|null;
export function operatingStatus(settings:InstagramOperatingSettings|null,connection:OperatingConnection,account:string,env:Record<string,string|undefined>,now=Date.now()):InstagramOperatingStatus{
 const validSettings=!!settings&&settings.account_id===account&&Number.isSafeInteger(settings.version)&&settings.version>=0&&instagramCapabilities.every(k=>typeof settings[k]==='boolean');
 const requested={publishing:validSettings&&settings.publishing,receive:validSettings&&settings.receive,send:validSettings&&settings.send};
 const connected=!!connection&&connection.account_id===account&&Date.parse(connection.expires_at)>now;
 const scopes=Array.isArray(connection?.scopes)?connection.scopes:[];
 const common=[...(!validSettings?['Admin controls database is unavailable.']:[]),...(!connected?['Connect an unexpired Instagram account.']:[]),...(!scopes.includes('instagram_business_basic')?['Instagram basic permission is missing.']:[])];
 const workerTime=Date.parse(settings?.worker_seen_at||'');
 const recentWorker=Number.isFinite(workerTime)&&workerTime<=now&&now-workerTime<5*60000;
 const verifiedTime=Date.parse(settings?.webhook_verified_at||'');
 const callbackVerified=Number.isFinite(verifiedTime)&&verifiedTime<=now;
 const readiness={
  publishing:{ready:false,blockers:[...common,...(env.INSTAGRAM_PUBLISHING_ENABLED!=='1'?['Publishing is disabled in deployment configuration.']:[]),...(!scopes.includes('instagram_business_content_publish')?['Publishing permission is missing.']:[]),...((env.CRON_SECRET||'').length<16?['Scheduler authentication is not configured.']:[]),...(!recentWorker?['No authenticated scheduler check-in in the last five minutes.']:[])]},
  receive:{ready:false,blockers:[...common,...(env.INSTAGRAM_WEBHOOK_ENABLED!=='1'?['Reception is disabled in deployment configuration.']:[]),...(!scopes.includes('instagram_business_manage_messages')?['Messaging permission is missing.']:[]),...((env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN||'').length<16?['Webhook verification token is not configured.']:[]),...((env.INSTAGRAM_WEBHOOK_APP_SECRET||'').length<16?['Webhook signature verification is not configured.']:[]),...(!callbackVerified?['Webhook callback challenge has not been verified.']:[])]},
  send:{ready:false,blockers:[...common,...(env.INSTAGRAM_OUTBOUND_MESSAGES_ENABLED!=='1'?['Sending is disabled in deployment configuration.']:[]),...(!scopes.includes('instagram_business_manage_messages')?['Messaging permission is missing.']:[])]}
 };
 for(const k of instagramCapabilities)readiness[k].ready=readiness[k].blockers.length===0;
 return {available:validSettings,version:validSettings?settings.version:0,requested,enabled:{publishing:requested.publishing&&readiness.publishing.ready,receive:requested.receive&&readiness.receive.ready,send:requested.send&&readiness.send.ready},readiness,workerLastSeen:validSettings?settings.worker_seen_at:null,callbackVerifiedAt:validSettings?settings.webhook_verified_at:null,subscriptionStatus:'not_verified'};
}
export function operatingChange(value:unknown):{capability:InstagramCapability;enabled:boolean;version:number}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('instagram_control_invalid');
 const b=value as Record<string,unknown>;
 if(Object.keys(b).sort().join(',')!=='capability,enabled,version'||!instagramCapabilities.includes(b.capability as InstagramCapability)||typeof b.enabled!=='boolean'||!Number.isSafeInteger(b.version)||Number(b.version)<0)throw Error('instagram_control_invalid');
 return {capability:b.capability as InstagramCapability,enabled:b.enabled,version:Number(b.version)};
}
