import {validOperatorOrigin} from '@/lib/content-access';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
import {publishApprovedNow} from '@/lib/instagram/foreground-server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=180;
export async function POST(request:Request){
 if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});
 let actor:string;try{actor=await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 let body:{id:string;version:number};try{const text=await request.text();if(text.length>500)throw Error();const b=JSON.parse(text);if(!b||Object.keys(b).sort().join(',')!=='id,version'||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||!Number.isSafeInteger(b.version)||b.version<1)throw Error();body=b;}catch{return Response.json({error:'Choose the saved post version.'},{status:400,headers:instagramHeaders});}
 try{const result=await publishApprovedNow(instagramServer(),actor,body.id,body.version);return Response.json(result,{status:result.status==='published'?200:['failed','cancelled','future'].includes(result.status)?409:202,headers:instagramHeaders});}
 catch{return Response.json({status:'unconfirmed',error:'Publishing was not confirmed. Refresh the calendar before any further action; do not create a duplicate.'},{status:409,headers:instagramHeaders});}
}
