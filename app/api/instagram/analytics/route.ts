import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
import {readPostAnalytics} from '@/lib/instagram/analytics';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(request:Request){
 try{await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 const params=new URL(request.url).searchParams,id=params.get('id')||'';if([...params.keys()].length!==1||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))return Response.json({error:'Choose a published calendar post.'},{status:400,headers:instagramHeaders});
 try{const s=instagramServer();const {data:job,error}=await s.db.from('instagram_publish_jobs').select('media_id,account_id,state').eq('post_id',id).eq('account_id',s.config.accountId).eq('state','published').order('post_version',{ascending:false}).limit(1).maybeSingle();
  if(error)throw Error();if(!job||job.account_id!==s.config.accountId||job.state!=='published'||typeof job.media_id!=='string'||!/^[1-9]\d{0,39}$/.test(job.media_id))return Response.json({error:'Results require an Instagram-confirmed published post.'},{status:404,headers:instagramHeaders});
  const {token,scopes}=await s.analyticsCredentials();const result=await readPostAnalytics(job.media_id,scopes,{basic:()=>s.api.mediaEngagement(token,job.media_id),insight:metric=>s.api.mediaInsights(token,job.media_id,metric)});return Response.json(result,{headers:instagramHeaders});
 }catch{return Response.json({error:'Instagram results could not be loaded. Try again later.'},{status:503,headers:instagramHeaders});}
}
