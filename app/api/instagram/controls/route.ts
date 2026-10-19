import {validOperatorOrigin} from '@/lib/content-access';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
import {operatingChange} from '@/lib/instagram/operating-controls';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in Admin controls.'},{status:403,headers:instagramHeaders});
 let actor:string;try{actor=await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 let change:ReturnType<typeof operatingChange>;try{const raw=await request.text();if(raw.length>500)throw Error();change=operatingChange(JSON.parse(raw));}catch{return Response.json({error:'Invalid control change.'},{status:400,headers:instagramHeaders});}
 try{const s=instagramServer();return Response.json({operations:await s.operations.change(actor,change.capability,change.enabled,change.version)},{headers:instagramHeaders});}
 catch{return Response.json({error:'Control was not saved. Refresh to check readiness or a change from another tab.'},{status:409,headers:instagramHeaders});}
}
