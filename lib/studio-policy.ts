export function studioBridgeOrigin(environment:Record<string,string|undefined>,host:string|null){
 if(environment.NODE_ENV!=='development'||!/^(127\.0\.0\.1|localhost):\d+$/.test(host||''))return null;
 try{const origin=new URL(environment.LUUN_STUDIO_ORIGIN||'');if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||origin.host===host||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)return null;return origin.origin;}catch{return null;}
}
export function studioRouteAllowed(parts:string[],method:string){
 const path=parts.join('/');
 if(method==='GET')return path==='state'||path==='status'||/^media\/[a-f0-9-]+\.(png|jpg|jpeg|webp)$/.test(path);
 if(method==='POST')return ['generate','rooms','stop','references'].includes(path);
 return method==='PATCH'&&/^(assets|references)\/[a-f0-9-]+$/.test(path);
}
export function studioForwardHeaders(request:Request,origin:string){
 const headers=new Headers();const contentType=request.headers.get('content-type');if(contentType)headers.set('content-type',contentType);headers.set('origin',origin);return headers;
}
