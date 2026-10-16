import {getUserContext,canViewFinancials} from '@/lib/auth';
import {validOperatorOrigin} from '@/lib/content-access';
import {loadAcquisition,preferredAcquisitionMonth} from '@/lib/acquisition-service';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function respond(request:Request,readWise:boolean){
 const context=await getUserContext();if(!context.user)return Response.json({error:'Authentication required.'},{status:401,headers});if(!canViewFinancials(context.profile?.role))return Response.json({error:'Owner/admin access required.'},{status:403,headers});
 if(readWise&&!validOperatorOrigin(request))return Response.json({error:'Use the signed-in workspace.'},{status:403,headers});
 const month=new URL(request.url).searchParams.get('month')||await preferredAcquisitionMonth(context.supabase);
 try{return Response.json(await loadAcquisition(context.supabase,month,readWise),{headers});}catch{return Response.json({error:'Monthly acquisition evidence is unavailable or incomplete. No zero spend is assumed.'},{status:503,headers});}
}
export const GET=(request:Request)=>respond(request,false);
export const POST=(request:Request)=>respond(request,true);
