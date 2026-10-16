import { operatorAccess,validOperatorOrigin } from '@/lib/content-access';
import { canEditContent } from '@/lib/content-permissions';
import { studioBridgeOrigin } from '@/lib/studio-policy';
import { forwardStudioRequest } from '@/lib/studio-bridge';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
async function handle(request:Request,context:{params:Promise<{parts:string[]}>}){
 const access=await operatorAccess(request);if(access.kind==='denied')return Response.json({error:'Sign in to use the image Studio.'},{status:access.status});
 const origin=studioBridgeOrigin(process.env,request.headers.get('host'));if(!origin)return Response.json({error:'The local Creative Lab connection is unavailable. Open the installed Creative Lab app and verify its loopback service address.'},{status:503});
 if(request.method!=='GET'){
  // Form uploads use multipart rather than JSON; preserve the same-origin check.
  let sameOrigin=false;try{sameOrigin=new URL(request.headers.get('origin')||'').host===request.headers.get('host');}catch{}
  if(!sameOrigin||(!request.headers.get('content-type')?.startsWith('multipart/form-data')&&!validOperatorOrigin(request)))return Response.json({error:'Use the signed-in Studio interface.'},{status:403});
  if(access.kind==='database'&&!canEditContent(access.role))return Response.json({error:'Not authorized to change Studio content.'},{status:403});
 }
 return forwardStudioRequest(request,(await context.params).parts,origin);
}
export const GET=handle;export const POST=handle;export const PATCH=handle;
