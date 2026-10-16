import {operatorDate} from './operator-dates';
import type { BusinessPlan } from './business-plan';
import type { ContentPost } from './content';
export type WorkItem={id:string;source:'commitment'|'content';title:string;date:string;plannedAt:string|null;action:string;blockedBy:string[]};
export function buildWorkPlan(plan:BusinessPlan,posts:ContentPost[],timeZone='UTC'):WorkItem[]{
 const commitments:WorkItem[]=plan.commitments.filter(item=>item.status!=='done').map(item=>({id:item.id,source:'commitment',title:item.title,date:item.dueDate,plannedAt:null,action:'Complete the confirmed commitment and record evidence.',blockedBy:[]}));
 const content:WorkItem[]=posts.filter(post=>post.status!=='published').map(post=>{
  const blockedBy:string[]=[];
  if(!post.objective)blockedBy.push('Business objective needed');
  if(!post.assetReference)blockedBy.push('Select an asset');
  if(!post.caption)blockedBy.push('Caption needed');
  if(!post.approvedAt)blockedBy.push('Review and approval needed');
  if(post.planVersion!==undefined&&post.planVersion!==plan.version)blockedBy.push('Shared plan changed; review again');
  const action=post.status==='planned'?'Prepare manual publication at the planned time; Instagram automation is unavailable.':post.status==='approved'?'Choose a planned publication time.':post.status==='needs_review'?'Review the caption, asset, rights and current business plan.':'Prepare the post package for review.';
  return {id:post.id,source:'content',title:post.title,date:post.plannedAt?operatorDate(post.plannedAt,timeZone):post.dueDate,plannedAt:post.plannedAt||null,action,blockedBy};
 });
 return [...commitments,...content].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.plannedAt||'').localeCompare(b.plannedAt||'')||a.title.localeCompare(b.title));
}
