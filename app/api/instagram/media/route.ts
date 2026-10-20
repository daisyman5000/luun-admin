import {randomUUID} from 'node:crypto';
import {inspectJpeg,sha256} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{const origin=new URL(request.headers.get('origin')||'');if(origin.host!==request.headers.get('host')||origin.protocol!=='https:')throw Error();}catch{return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});}
 let actor:string;try{actor=await instagramOwner();}catch{return Response.json({error:'Your calendar session expired. Sign in again, then upload the image.'},{status:403,headers:instagramHeaders});}
 let stage='setup';
 try{const s=instagramServer();stage='size';if(Number(request.headers.get('content-length')||0)>4*1024*1024+65536)return Response.json({error:'Choose a smaller JPEG image.'},{status:413,headers:instagramHeaders});
  const reader=request.body?.getReader();if(!reader)throw Error();const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>4*1024*1024+65536){await reader.cancel();throw Error();}chunks.push(r.value);}stage='format';const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();const file=form.get('media');if(!(file instanceof File)||file.type!=='image/jpeg')throw Error();const bytes=Buffer.from(await file.arrayBuffer());let dimensions:{width:number;height:number};try{dimensions=inspectJpeg(bytes);}catch(e){stage=e instanceof Error&&e.message==='instagram_image_dimensions'?'dimensions':'format';throw Error();}const id=randomUUID(),path=id+'.jpg';
  stage='storage';const uploaded=await s.db.storage.from('instagram-media').upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(uploaded.error)throw Error();stage='record';const record=await s.db.from('instagram_media').insert({id,path,sha256:sha256(bytes),mime:'image/jpeg',size:bytes.length,...dimensions,uploaded_by:actor});if(record.error){await s.db.storage.from('instagram-media').remove([path]);throw Error();}return Response.json({assetReference:'instagram-media:'+id},{headers:instagramHeaders});
 }catch{const errors:Record<string,string>={setup:'Image storage is not configured. Contact the app administrator.',size:'Choose a smaller JPEG image.',format:'This file could not be read as JPEG. Export it as JPEG and try again.',dimensions:'This image needs resizing. Choose it again to prepare it for Instagram.',storage:'The private image store rejected the upload. Try again; if it repeats, contact the app administrator.',record:'The image could not be saved to the calendar. Try uploading again.'};return Response.json({error:errors[stage],code:'image_'+stage},{status:stage==='size'?413:['format','dimensions'].includes(stage)?422:503,headers:instagramHeaders});}
}

export async function GET(request:Request){
 try{await instagramOwner();}catch{return Response.json({error:'Owner/admin sign-in required.'},{status:403,headers:instagramHeaders});}
 try{const id=new URL(request.url).searchParams.get('id')||'',s=instagramServer(),m=await s.media(id);const result=await s.db.storage.from('instagram-media').createSignedUrl(m.path,300);if(result.error||!result.data)throw Error();return Response.json({url:result.data.signedUrl},{headers:instagramHeaders});}
 catch{return Response.json({error:'Image preview unavailable.'},{status:503,headers:instagramHeaders});}
}
