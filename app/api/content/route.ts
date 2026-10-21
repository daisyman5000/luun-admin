import { operatorAccess, validOperatorOrigin } from '@/lib/content-access';
import { canEditContent, canApproveContent } from '@/lib/content-permissions';
import { localContentStore } from '@/lib/content-store';
import { localBusinessPlanStore } from '@/lib/business-plan';
import {instagramServer} from '@/lib/instagram/server';
import {deliveryStatus,type JobState} from '@/lib/instagram/core';
import { installedCreativeLibrary } from '@/lib/creative-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await operatorAccess(request);
 if(access.kind==='denied')return Response.json({error:'Authenticated workspace access or configuration is required.'},{status:access.status});
 try{const [posts,plan]=access.kind==='local'?[localContentStore().list(),localBusinessPlanStore().read()]:await Promise.all([access.store.listPosts(),access.store.readPlan()]);let calendarPosts=posts,publishingConnected=false;if(access.kind==='database')try{const s=instagramServer(),connection=await s.connection();publishingConnected=!!connection&&Date.parse(connection.expires_at)>Date.now();const result=await s.db.rpc('instagram_calendar_statuses',{p_ids:posts.map(p=>p.id),p_account:s.config.accountId});if(!result.error){const jobs=new Map<string,{state:JobState;permalink:string|null;error_code:string|null}>();for(const j of result.data||[])if(!jobs.has(j.post_id))jobs.set(j.post_id,j);calendarPosts=posts.map(p=>{const j=jobs.get(p.id);return j&&!(p.status==='published'&&j.state!=='published')?{...p,delivery:{status:deliveryStatus(j.state),state:j.state,permalink:j.permalink,errorCode:j.error_code}}:p;});}}catch{/* Calendar remains usable before Instagram setup. */}return Response.json({posts:calendarPosts,plan,storage:access.kind,canEdit:access.kind==='local'||canEditContent(access.role),canApprove:access.kind==='local'||canApproveContent(access.role),publishingConnected},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Content storage is unavailable. The operator-workspace migration must be applied in the confirmed environment; no local fallback is used.'},{status:503});}
}
export async function POST(request:Request){
 const access=await operatorAccess(request);
 if(access.kind==='denied')return Response.json({error:'Authenticated workspace access or configuration is required.'},{status:access.status});
 if(!validOperatorOrigin(request))return Response.json({error:'Use this workspace to save content.'},{status:403});
 if(access.kind==='database'&&!canEditContent(access.role))return Response.json({error:'Not authorized to edit content.'},{status:403});
 const raw=await request.text();if(raw.length>20000)return Response.json({error:'Post package is too large.'},{status:413});
 try{const body=JSON.parse(raw);let post;
 if(access.kind==='local'){if(typeof body.assetReference==='string'&&body.assetReference.startsWith('creative-lab:'))installedCreativeLibrary().resolve(body.assetReference);post=localContentStore().save(body,localBusinessPlanStore().read());}else{post=await access.store.savePost(body,access.role);}
 return Response.json({post});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to save.'},{status:400});}
}

export async function DELETE(request:Request){
 const headers={'Cache-Control':'private, no-store'};if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in calendar.'},{status:403,headers});const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Authenticated workspace access required.'},{status:access.status,headers});if(access.kind!=='database')return Response.json({error:'Deletion requires the private database calendar.'},{status:503,headers});if(!canApproveContent(access.role))return Response.json({error:'Owner/admin access required.'},{status:403,headers});
 let body:{id:string;version:number};try{const raw=await request.text();if(raw.length>500)throw Error();const value=JSON.parse(raw);if(!value||Object.keys(value).sort().join(',')!=='id,version'||typeof value.id!=='string'||!/^[a-f0-9-]{36}$/.test(value.id)||!Number.isSafeInteger(value.version)||value.version<1)throw Error();body=value;}catch{return Response.json({error:'Choose the saved post version.'},{status:400,headers});}
 try{const post=await access.store.archivePost(body.id,body.version,access.role);return Response.json({id:post.id,deleted:true},{headers});}catch(e){return Response.json({error:e instanceof Error?e.message:'Deletion was not confirmed. Refresh the calendar.'},{status:409,headers});}
}
