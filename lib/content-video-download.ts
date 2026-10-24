// Same-origin authenticated download; the caller must verify ownership and media integrity first.
export function videoDownloadResponse(bytes:Uint8Array,name:string){
 if(!bytes.length||bytes.length>100*1024*1024)throw Error('Video download exceeds its bound');
 const filename=(name.split(' — ')[0].replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)||'Luun-video')+'.mp4';let offset=0;
 const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}const end=Math.min(offset+65536,bytes.length);controller.enqueue(bytes.subarray(offset,end));offset=end;}});
 return new Response(stream,{headers:{'Content-Type':'video/mp4','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
