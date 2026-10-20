import fs from 'node:fs';
import {Readable} from 'node:stream';
import {contentVideoAllowed,localVideoCall,videoDownloadPath} from '@/lib/content-video';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function bounded(request:Request,limit:number){const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);let size=0;const chunks:Buffer[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Local video request exceeds size bound');chunks.push(Buffer.from(value));}}catch(e){await reader.cancel().catch(()=>{});throw e;}return Buffer.concat(chunks);}
export async function GET(request:Request){
 if(!contentVideoAllowed(request))return Response.json({error:'Video is a local-only prototype. Hosted persistence/media/rendering are not enabled.'},{status:503,headers});
 try{const q=new URL(request.url).searchParams;
  if(q.has('preview')){const r=await localVideoCall({action:'preview',id:q.get('id'),preview:q.get('preview')}) as {jpeg:string};return new Response(Buffer.from(r.jpeg,'base64'),{headers:{...headers,'Content-Type':'image/jpeg'}});}
  if(q.has('frame')){const r=await localVideoCall({action:'frame',sourceId:q.get('frame'),offset:Number(q.get('offset')||0)}) as {jpeg:string};return new Response(Buffer.from(r.jpeg,'base64'),{headers:{...headers,'Content-Type':'image/jpeg'}});}
  if(q.has('download')){const r=await localVideoCall({action:'download',id:q.get('download')}) as {file:string};return new Response(Readable.toWeb(fs.createReadStream(videoDownloadPath(r.file))) as ReadableStream,{headers:{...headers,'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="Luun-local-rough-cut.mp4"'}});}
  return Response.json(await localVideoCall(q.has('context')?{action:'context',id:q.get('context')}:{action:'list'}),{headers});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Local video unavailable'},{status:400,headers});}
}
export async function POST(request:Request){
 if(!contentVideoAllowed(request))return Response.json({error:'Local video access required; no hosted changes were made.'},{status:503,headers});
 try{const multipart=request.headers.get('content-type')?.includes('multipart/form-data');let b:Record<string,unknown>;
  if(multipart){const raw=await bounded(request,26*1024*1024);const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')!},body:raw}).formData();const file=form.get('file');if(!(file instanceof File)||file.size>25*1024*1024)throw Error('Idea/final narration audio must be under 25 MB');const kind=form.get('kind');if(!['voice','narration'].includes(String(kind)))throw Error('Choose idea-note or final narration audio');b={action:kind,id:form.get('id'),revision:Number(form.get('revision')),type:file.type,audio:Buffer.from(await file.arrayBuffer()).toString('base64'),confirmed:form.get('confirmed')==='true'};
  }else{b=JSON.parse((await bounded(request,32000)).toString());if(!['create','duration','idea','feedback','handoff','approve-script','approve-board','render','silent'].includes(String(b.action)))throw Error('Unsupported video action');}
  return Response.json(await localVideoCall(b),{headers});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Local video action failed'},{status:400,headers});}
}
