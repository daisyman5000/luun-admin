import { readBusinessGoal,readDailyAdBudget } from './business-goal';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validatePost, type ContentPost } from './content';
import { validateBusinessPlan } from './business-plan-validation';
import type { BusinessPlan } from './business-plan';
import { requireContentWrite, canEditBusinessPlan } from './content-permissions';
export type OperatorDatabase=Pick<SupabaseClient,'from'|'rpc'>;
export function createOperatorDatabase(db:OperatorDatabase){
 async function readPlan():Promise<BusinessPlan>{
  const {data,error}=await db.from('operator_business_plan').select('package').eq('id',1).single<{package:BusinessPlan}>();
  if(error||!data)throw new Error('Shared plan database is unavailable. Apply the operator-workspace migration in the confirmed environment.');return data.package;
 }
 async function listPosts():Promise<ContentPost[]>{
  const {data,error}=await db.from('operator_content_posts').select('package').order('updated_at',{ascending:false}).limit(500).returns<{package:ContentPost}[]>();
  if(error)throw new Error('Content database is unavailable. Apply the operator-workspace migration in the confirmed environment.');return (data||[]).map(row=>row.package);
 }
 async function savePost(body:Record<string,unknown>,role:string|null|undefined):Promise<ContentPost>{
  let previous:ContentPost|undefined;
  if(body.id){if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))throw new Error('Invalid post ID.');const {data,error}=await db.from('operator_content_posts').select('package').eq('id',body.id).single<{package:ContentPost}>();if(error||!data)throw new Error('Post not found or unavailable.');previous=data.package;}
  requireContentWrite(role,body.status,previous?.status);
  if(previous&&body.version!==previous.version)throw new Error('This post changed in another tab. Reopen it before saving.');
  const draft=validatePost(body,previous),plan=await readPlan();
  if(draft.assetReference.startsWith('creative-lab:')&&['approved','planned','published'].includes(draft.status))throw new Error('This Creative Lab asset is still on the Mac. Connect approved private media storage before database approval.');
  if(previous?.approvedAt&&previous.status!=='published'&&previous.planVersion!==plan.version&&['approved','planned','published'].includes(draft.status))throw new Error('The shared plan changed. Save as Needs review before approving again.');
  const {data,error}=await db.rpc('save_operator_content_post',{p_id:previous?.id||null,p_expected_version:previous?.version||0,p_package:draft,p_plan_version:plan.version});
  if(error||!data)throw new Error('Content was not saved. Reload to check the current version, permissions and database migration.');return data as ContentPost;
 }
 async function savePlan(body:Record<string,unknown>,role:string|null|undefined):Promise<BusinessPlan>{
  if(!canEditBusinessPlan(role))throw new Error('Owner/admin access is required to change the business plan.');
  const plan=validateBusinessPlan(body);if(!Number.isSafeInteger(body.version)||Number(body.version)<0)throw new Error('Invalid plan version.');
  const {data,error}=await db.rpc('save_operator_business_plan',{p_expected_version:body.version,p_package:plan});
  if(error||!data)throw new Error('Business plan was not saved. Reload to check the current version, permissions and database migration.');return data as BusinessPlan;
 }
 return {readPlan,listPosts,savePost,savePlan};
}
export async function readOperatorContext(db:OperatorDatabase){
 try{const plan=await createOperatorDatabase(db).readPlan();return {available:true as const,planVersion:plan.version,goal:readBusinessGoal(plan.goal),dailyAdBudget:readDailyAdBudget(plan.dailyAdBudget),objective:plan.objective,targetDate:plan.targetDate,promotionFocus:plan.promotionFocus,customerPromise:plan.customerPromise,constraints:plan.constraints,commitments:plan.commitments,updatedAt:plan.updatedAt};}catch{return {available:false as const,message:'Shared business plan is not configured in this environment.'};}
}
