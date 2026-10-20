import {CaptionError,captionLimiter,generateCaption} from '@/lib/instagram/caption';
import {inspectJpeg,sha256} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export const maxDuration=60;
const limit=captionLimiter();
export async function POST(request:Request){
 try{const origin=new URL(request.headers.get('origin')||'');if(origin.host!==request.headers.get('host')||origin.protocol!=='https:')throw Error();}catch{return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});}
 let actor:string;try{actor=await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 try{
  const reader=request.body?.getReader();if(!reader)throw new CaptionError(400,'Choose an uploaded image first.');let text='';const decoder=new TextDecoder();let length=0;for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>256){await reader.cancel();throw new CaptionError(400,'Invalid caption request.');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
  let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{throw new CaptionError(400,'Invalid caption request.');}
  if(!body||Array.isArray(body)||Object.keys(body).length!==1||typeof body.mediaId!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(body.mediaId))throw new CaptionError(400,'Choose an uploaded image first.');
  if(!process.env.OPENAI_API_KEY)throw new CaptionError(503,'Caption generation is not configured. The existing OpenAI API key must be available to this deployment.');
  limit(actor);const s=instagramServer(),media=await s.media(body.mediaId);if(media.size>8*1024*1024||media.mime!=='image/jpeg')throw Error();
  const result=await s.db.storage.from('instagram-media').download(media.path);if(result.error||!result.data||result.data.size>8*1024*1024)throw Error();const bytes=Buffer.from(await result.data.arrayBuffer());inspectJpeg(bytes);if(sha256(bytes)!==media.sha256)throw Error();
  const caption=await generateCaption(bytes);return Response.json({caption},{headers:instagramHeaders});
 }catch(e){return Response.json({error:e instanceof CaptionError?e.message:'Caption generation unavailable. Your caption is unchanged.'},{status:e instanceof CaptionError?e.status:503,headers:instagramHeaders});}
}
