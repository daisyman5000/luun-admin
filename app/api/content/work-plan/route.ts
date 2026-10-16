import { operatorAccess } from '@/lib/content-access';
import { localBusinessPlanStore } from '@/lib/business-plan';
import { localContentStore } from '@/lib/content-store';
import { buildWorkPlan } from '@/lib/work-plan';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Authenticated work-plan access or configuration required.'},{status:access.status});
 try{const [plan,posts]=access.kind==='local'?[localBusinessPlanStore().read(),localContentStore().list()]:await Promise.all([access.store.readPlan(),access.store.listPosts()]);return Response.json({planVersion:plan.version,objective:plan.objective,customerPromise:plan.customerPromise,promotionFocus:plan.promotionFocus,constraints:plan.constraints,items:buildWorkPlan(plan,posts),storage:access.kind,automaticActionsEnabled:false,dateSemantics:'Planned timestamps are UTC; ready-by and commitment dates are date-only. No work hours are inferred.'},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Saved planning records are unavailable.'},{status:503});}
}
