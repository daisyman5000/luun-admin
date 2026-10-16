import { studioRouteAllowed,studioForwardHeaders } from './studio-policy';
export async function forwardStudioRequest(request:Request,parts:string[],origin:string,fetcher:typeof fetch=fetch){
 if(!studioRouteAllowed(parts,request.method))return Response.json({error:'This interface supports image Studio operations only.'},{status:404});
 if(parts[0]==='status'){
  try{const response=await fetcher(origin+'/',{redirect:'error',signal:AbortSignal.timeout(5000)});const html=await response.text();if(!response.ok||!html.includes('LUUN Creative Lab'))throw new Error('Unavailable');return Response.json({available:true,imageStudioOnly:true,credentialsRemainInCreativeLab:true});}catch{return Response.json({error:'The existing Creative Lab image service is not available. Open the installed app first.'},{status:503});}
 }
 const headers=studioForwardHeaders(request,origin);let body:ArrayBuffer|undefined;
 if(request.method!=='GET'){body=await request.arrayBuffer();if(body.byteLength>35*1024*1024)return Response.json({error:'Keep image uploads under 35 MB per request.'},{status:413});}
 const target=origin+'/api/'+parts.join('/')+(parts[0]==='media'&&new URL(request.url).searchParams.has('download')?'?download':'');
 try{const upstream=await fetcher(target,{method:request.method,headers,body,redirect:'error',signal:AbortSignal.timeout(120000)});
  if(parts[0]==='media')return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('content-type')||'application/octet-stream','Content-Disposition':upstream.headers.get('content-disposition')||'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  const data=await upstream.json();
  if(upstream.ok&&(parts[0]==='state'||(data&&typeof data==='object'&&'assets' in data&&'settings' in data))){const safe=Object.fromEntries(['version','references','assets','jobs','roomBrowser','scenes','connected'].map(key=>[key,data[key]]));safe.settings=Object.fromEntries(['model','quality','size','sourceReferenceId','productDimensions','measurementSource','planningModel'].map(key=>[key,data.settings?.[key]]));return Response.json(safe,{headers:{'Cache-Control':'private, no-store'}});}
  return Response.json(data,{status:upstream.status,headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Creative Lab did not respond. Existing files and results remain in its library; do not retry a generation until its status is checked.'},{status:503});}
}
