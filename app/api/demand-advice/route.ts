import { getUserContext,canViewFinancials } from '@/lib/auth';
import { validOperatorOrigin } from '@/lib/content-access';
import { loadDemandData } from '@/lib/demand-page';
import { decisionSnapshot,requestDecisionAdvice,strategyAIConfiguration } from '@/lib/strategy-ai';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){
 const context=await getUserContext();if(!context.user)return Response.json({error:'Sign in required.'},{status:401});if(!canViewFinancials(context.profile?.role))return Response.json({error:'Owner/admin access required.'},{status:403});if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in decision interface.'},{status:403});
 const config=strategyAIConfiguration(process.env);if(!config.configured)return Response.json({error:'AI decision support needs server-side '+config.missing.join(' and ')+'. Select an approved Responses API model supporting strict JSON schema. No model was assumed.',configured:false},{status:503});
 // Ignore client data entirely: query a fresh session-scoped situation; no customer records enter the provider packet.
 try{const {strategy}=await loadDemandData(context.supabase);return Response.json(await requestDecisionAdvice(decisionSnapshot(strategy),process.env),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'AI advice could not be produced or failed evidence validation. Refresh the situation and check provider configuration; no action was executed.'},{status:502});}
}
