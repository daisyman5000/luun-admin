import {getUserContext,canViewFinancials} from '@/lib/auth';
import {loadDailyOverview} from '@/lib/daily-overview-server';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){const {user,profile}=await getUserContext();const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};if(!user)return Response.json({error:'Authentication required'},{status:401,headers});if(!canViewFinancials(profile?.role))return Response.json({error:'Owner/admin access required'},{status:403,headers});try{return Response.json(await loadDailyOverview(),{headers});}catch{return Response.json({error:'Daily overview unavailable'},{status:503,headers});}}
