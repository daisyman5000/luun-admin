import {funnelAIStatus,runFunnelAI} from '@/lib/funnel-ai-server';
import {getUserContext,canViewFinancials} from '@/lib/auth';
import {validOperatorOrigin} from '@/lib/content-access';
import {validDay,actualDay} from '@/lib/forecast-actual';
import {funnelReport,saveFunnelReview} from '@/lib/funnel-server';
import {createAdminClient} from '@/lib/supabase/admin';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=120;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function context(r:Request){const c=await getUserContext();if(!c.user)throw Error('Authentication required');if(!canViewFinancials(c.profile?.role))throw Error('Owner/admin access required');const q=new URL(r.url).searchParams,today=actualDay(new Date().toISOString()),from=q.get('from')||today,through=q.get('through')||today;if(!validDay(from)||!validDay(through)||through<from||through>today||Date.parse(through)-Date.parse(from)>31*86400000)throw Error('Choose up to 32 days through today');return {from,through,actor:c.user.id};}
function fail(e:unknown){const error=e instanceof Error?e.message:'Funnel unavailable';return Response.json({error},{status:/Authentication/.test(error)?401:/access required/.test(error)?403:400,headers});}
export async function GET(r:Request){try{const p=await context(r);const report=await funnelReport(p.from,p.through);const history=await createAdminClient().from('funnel_reviews').select('id,from_day,through_day,created_at,package').order('created_at',{ascending:false}).limit(10);if(history.error)throw Error('Review history unavailable');return Response.json({...report,history:history.data,ai:await funnelAIStatus()},{headers});}catch(e){return fail(e);}}
export async function POST(r:Request){try{const p=await context(r);if(!validOperatorOrigin(r))return Response.json({error:'Same-origin JSON request required'},{status:403,headers});const report=await saveFunnelReview(p.from,p.through,p.actor);const history=await createAdminClient().from('funnel_reviews').select('id,from_day,through_day,created_at,package').order('created_at',{ascending:false}).limit(10);if(history.error)throw Error('Review history unavailable');return Response.json({...report,history:history.data,ai:await runFunnelAI(p.actor)},{headers});}catch(e){return fail(e);}}
