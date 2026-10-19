import {instagramInbound,verifyInstagramWebhook,webhookChallenge} from '@/lib/instagram/messages';
import {instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){if(process.env.INSTAGRAM_WEBHOOK_ENABLED!=='1')return new Response('Webhook disabled',{status:503});try{const challenge=webhookChallenge(new URL(request.url).searchParams,process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN);await instagramServer().operations.observe('webhook');return new Response(challenge,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}catch{return new Response('Verification failed',{status:403});}}
export async function POST(request:Request){if(process.env.INSTAGRAM_WEBHOOK_ENABLED!=='1')return new Response('Webhook disabled',{status:503});try{
 const reader=request.body?.getReader();if(!reader)throw Error();const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>1024*1024){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(r.value);}const bytes=Buffer.concat(chunks);
 if(!verifyInstagramWebhook(bytes,request.headers.get('x-hub-signature-256'),process.env.INSTAGRAM_WEBHOOK_APP_SECRET||''))return new Response('Signature required',{status:403});
 const s=instagramServer();if(!(await s.operations.status()).enabled.receive)return Response.json({received:false,disabled:true},{headers:{'Cache-Control':'no-store'}});const messages=instagramInbound(JSON.parse(bytes.toString('utf8')),s.config.accountId);if(messages.length){await s.operations.requireEnabled('receive');const {error}=await s.db.from('instagram_inbox_messages').upsert(messages,{onConflict:'account_id,provider_message_id',ignoreDuplicates:true});if(error)throw Error();}
 return Response.json({received:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Webhook unavailable',{status:503});}}
