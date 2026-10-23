import {authorizedSourceSync} from '@/lib/source-sync-auth';
import {runFunnelAI} from '@/lib/funnel-ai-server';
import {FUNNEL_AI_OWNER} from '@/lib/funnel-ai';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
 if(!authorizedSourceSync(request.headers.get('authorization'),process.env))return Response.json({error:'Unauthorized'},{status:401,headers});
 try{const ai=await runFunnelAI(FUNNEL_AI_OWNER);return Response.json({checkedAt:new Date().toISOString(),message:ai.message,reservedMicrousd:ai.reservedMicrousd},{headers});}
 catch{return Response.json({error:'Funnel review check failed; budget and prior drafts retained'},{status:503,headers});}
}
