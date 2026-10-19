import {randomUUID} from 'node:crypto';
import {inspectJpeg,sha256} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{const origin=new URL(request.headers.get('origin')||'');if(origin.host!==request.headers.get('host')||origin.protocol!=='https:')throw Error();}catch{return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});}
 try{const actor=await instagramOwner(),s=instagramServer();if(Number(request.headers.get('content-length')||0)>8*1024*1024+65536)return Response.json({error:'Choose a JPEG under 8 MB.'},{status:413,headers:instagramHeaders});
  // Bound the body even when Content-Length is absent or dishonest.
  const reader=request.body?.getReader();if(!reader)throw Error();const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>8*1024*1024+65536){await reader.cancel();throw Error();}chunks.push(r.value);}const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();const file=form.get('media');if(!(file instanceof File)||file.type!=='image/jpeg')throw Error();const bytes=Buffer.from(await file.arrayBuffer()),dimensions=inspectJpeg(bytes),id=randomUUID(),path=id+'.jpg';
  const uploaded=await s.db.storage.from('instagram-media').upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(uploaded.error)throw Error();const record=await s.db.from('instagram_media').insert({id,path,sha256:sha256(bytes),mime:'image/jpeg',size:bytes.length,...dimensions,uploaded_by:actor});if(record.error){await s.db.storage.from('instagram-media').remove([path]);throw Error();}return Response.json({assetReference:'instagram-media:'+id},{headers:instagramHeaders});
 }catch{return Response.json({error:'Upload unavailable. Setup and owner/admin sign-in are required. Use a JPEG under 8 MB, width 320–1440px, aspect ratio 4:5–1.91:1.'},{status:400,headers:instagramHeaders});}
}
