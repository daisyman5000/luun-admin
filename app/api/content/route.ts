import { operatorAccess, validOperatorOrigin } from '@/lib/content-access';
import { canEditContent, canApproveContent } from '@/lib/content-permissions';
import { localContentStore } from '@/lib/content-store';
import { localBusinessPlanStore } from '@/lib/business-plan';
import { installedCreativeLibrary } from '@/lib/creative-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await operatorAccess(request);
 if(access.kind==='denied')return Response.json({error:'Authenticated workspace access or configuration is required.'},{status:access.status});
 try{const [posts,plan]=access.kind==='local'?[localContentStore().list(),localBusinessPlanStore().read()]:await Promise.all([access.store.listPosts(),access.store.readPlan()]);return Response.json({posts,plan,storage:access.kind,canEdit:access.kind==='local'||canEditContent(access.role),canApprove:access.kind==='local'||canApproveContent(access.role),publishingConnected:false},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Content storage is unavailable. The operator-workspace migration must be applied in the confirmed environment; no local fallback is used.'},{status:503});}
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
