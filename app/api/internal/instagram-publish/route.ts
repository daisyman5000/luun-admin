import {timingSafeEqual} from 'node:crypto';
import {instagramServer,instagramHeaders,jobPorts} from '@/lib/instagram/server';
import {runInstagramJob} from '@/lib/instagram/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(request:Request){
 const header=request.headers.get('authorization')||'',secret=process.env.CRON_SECRET||'',expected='Bearer '+secret;if(secret.length<16||header.length!==expected.length||!timingSafeEqual(Buffer.from(header),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401,headers:instagramHeaders});
 if(process.env.INSTAGRAM_PUBLISHING_ENABLED!=='1')return Response.json({status:'disabled'},{headers:instagramHeaders});
 let release:(()=>Promise<void>)|undefined;try{const s=instagramServer();await s.operations.observe('worker');if(!(await s.operations.status()).enabled.publishing)return Response.json({status:'disabled'},{headers:instagramHeaders});const p=jobPorts(s);release=p.release;return Response.json(await runInstagramJob(true,p.ports),{headers:instagramHeaders});}catch{return Response.json({error:'Instagram worker unavailable; inspect saved job status before any retry.'},{status:503,headers:instagramHeaders});}finally{if(release)try{await release();}catch{/* Existing lease expires; never remove another worker's lease. */}}
}
