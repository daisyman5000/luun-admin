import {createHmac,timingSafeEqual} from 'node:crypto';
import {sha256} from './core';
export function verifyInstagramWebhook(body:Buffer,signature:string|null,secret:string){if(secret.length<16||!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;const expected=createHmac('sha256',secret).update(body).digest();return timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'));}
export function webhookChallenge(params:URLSearchParams,token:string|undefined){const received=params.get('hub.verify_token')||'';if(params.get('hub.mode')!=='subscribe'||!token||token.length<16||Buffer.byteLength(received)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(received),Buffer.from(token))||!params.get('hub.challenge')||params.get('hub.challenge')!.length>500)throw Error('instagram_webhook_verification_failed');return params.get('hub.challenge')!;}
export type InboundMessage={account_id:string;provider_message_id:string;peer_id:string;body:string;received_at:string};
export function instagramInbound(raw:unknown,account:string,now=Date.now()):InboundMessage[]{
 const p=raw as {object?:string;entry?:{id?:string;messaging?:{sender?:{id?:string};recipient?:{id?:string};timestamp?:number;message?:{mid?:string;text?:string;is_echo?:boolean;attachments?:unknown[];is_deleted?:boolean}}[]}[]};
 if(!p||p.object!=='instagram'||!Array.isArray(p.entry)||p.entry.length>100)throw Error('instagram_webhook_invalid');const result=new Map<string,InboundMessage>();
 for(const entry of p.entry){if(!entry||typeof entry!=='object')continue;if(String(entry.id)!==account)continue;if(!Array.isArray(entry.messaging)||entry.messaging.length>100)continue;
  for(const e of entry.messaging){if(!e||typeof e!=='object')continue;const m=e.message,peer=String(e.sender?.id||'');if(!m||m.is_echo||m.is_deleted||String(e.recipient?.id)!==account||peer===account||!/^\d{1,40}$/.test(peer)||typeof m.mid!=='string'||!m.mid||m.mid.length>500||!Number.isFinite(e.timestamp)||e.timestamp!<=0||e.timestamp!>now+300000)continue;
   const text=typeof m.text==='string'?m.text:Array.isArray(m.attachments)&&m.attachments.length?'[Attachment received — text replies only]':'';if(!text||text.length>20000)continue;
   const message={account_id:account,provider_message_id:m.mid,peer_id:peer,body:text,received_at:new Date(e.timestamp!).toISOString()};if(!result.has(account+'|'+m.mid))result.set(account+'|'+m.mid,message);
  }
 }return [...result.values()];
}
export type Reply={id:string;account_id:string;peer_id:string;inbound_id:string;body:string;version:number;state:'draft'|'approved'|'sending'|'sent'|'unknown'|'failed';approval_hash:string|null;provider_message_id?:string|null;error_code?:string|null};
export const replyHash=(r:Pick<Reply,'account_id'|'peer_id'|'inbound_id'|'body'|'version'>)=>sha256(JSON.stringify([r.account_id,r.peer_id,r.inbound_id,r.body,r.version]));
export function replyWindow(receivedAt:string,now=Date.now()){const t=Date.parse(receivedAt);return Number.isFinite(t)&&t<=now&&now-t<24*3600000;}
export async function approvedReplySend(enabled:boolean,r:Reply,receivedAt:string,ports:{claim:()=>Promise<void>;send:()=>Promise<string>;save:(state:'sent'|'unknown'|'failed',id?:string)=>Promise<void>},now=Date.now()){
 if(!enabled)throw Error('instagram_replies_disabled');if(r.state!=='approved'||r.approval_hash!==replyHash(r)||!r.body.trim()||r.body.length>1000||!replyWindow(receivedAt,now))throw Error('instagram_reply_approval_required');
 await ports.claim();let confirmed:string|undefined;
 try{confirmed=await ports.send();await ports.save('sent',confirmed);return 'sent';}catch(e){const uncertain=!!confirmed||!(e instanceof Error)||!('uncertain' in e)||!!e.uncertain;await ports.save(uncertain?'unknown':'failed',confirmed);return uncertain?'unknown':'failed';}
}
