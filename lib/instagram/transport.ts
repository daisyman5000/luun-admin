import 'server-only';
import {request} from 'node:https';
/** Keep OAuth query credentials out of Next's fetch URL logging/cache instrumentation. */
export const instagramTransport:typeof fetch=async(input,init={})=>{
 const url=new URL(String(input));if(url.protocol!=='https:'||!['api.instagram.com','graph.instagram.com'].includes(url.hostname)||url.username||url.password)throw Error('instagram_transport_rejected');
 const headers=new Headers(init.headers);let body:string|undefined;
 if(init.body instanceof URLSearchParams){body=init.body.toString();headers.set('Content-Type','application/x-www-form-urlencoded');}else if(typeof init.body==='string')body=init.body;else if(init.body)throw Error('instagram_transport_rejected');
 return await new Promise<Response>((resolve,reject)=>{
  const req=request(url,{method:init.method||'GET',headers:Object.fromEntries(headers.entries()),signal:init.signal||undefined},res=>{const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1024*1024){req.destroy();reject(Error('instagram_response_unavailable'));}else chunks.push(chunk);});res.on('end',()=>{try{const status=res.statusCode||502;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers:{'Content-Type':'application/json'}}));}catch{reject(Error('instagram_response_unavailable'));}});res.on('error',()=>reject(Error('instagram_response_unavailable')));});
  req.setTimeout(20000,()=>req.destroy(Error('instagram_request_unavailable')));req.on('error',()=>reject(Error('instagram_request_unavailable')));if(body)req.write(body);req.end();
 });
};
