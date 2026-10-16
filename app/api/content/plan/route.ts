import { operatorAccess, validOperatorOrigin } from '@/lib/content-access';
import { localBusinessPlanStore } from '@/lib/business-plan';
import { canEditBusinessPlan } from '@/lib/content-permissions';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Authenticated plan access or configuration required.'},{status:access.status});
 try{return Response.json({plan:access.kind==='local'?localBusinessPlanStore().read():await access.store.readPlan(),canEdit:access.kind==='local'||canEditBusinessPlan(access.role),storage:access.kind},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Shared plan storage is unavailable. Confirm the environment and operator-workspace migration.'},{status:503});}
}
export async function POST(request:Request){
 const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Authenticated plan access or configuration required.'},{status:access.status});
 if(!validOperatorOrigin(request))return Response.json({error:'Use this workspace to save the plan.'},{status:403});
 if(access.kind==='database'&&!canEditBusinessPlan(access.role))return Response.json({error:'Owner/admin access required.'},{status:403});
 const raw=await request.text();if(raw.length>100000)return Response.json({error:'Plan is too large.'},{status:413});
 try{const body=JSON.parse(raw);return Response.json({plan:access.kind==='local'?localBusinessPlanStore().save(body):await access.store.savePlan(body,access.role)});}catch(error){return Response.json({error:error instanceof Error?error.message:'Cannot save plan.'},{status:400});}
}
