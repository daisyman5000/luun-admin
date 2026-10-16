import {getUserContext,canViewFinancials} from '@/lib/auth';
import {refreshWiseBalances} from '@/lib/wise/balance-service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const {user,profile}=await getUserContext();if(!user)return Response.json({error:'Authentication required.'},{status:401});if(!canViewFinancials(profile?.role))return Response.json({error:'Owner/admin access required.'},{status:403});
 try{return Response.json(await refreshWiseBalances(),{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'Balance refresh unavailable. Wait at least sixty seconds before trying again; no zero balance is assumed.'},{status:503,headers:{'Cache-Control':'private, no-store','Retry-After':'60'}});}
}
