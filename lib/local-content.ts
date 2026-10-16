export function localContentEnabled(host: string | null) {
 return process.env.NODE_ENV === "development" && process.env.LUUN_LOCAL_CONTENT === "1" && /^(127\.0\.0\.1|localhost):\d+$/.test(host || "");
}

export function localMediaRequestAllowed(request:Request){
 if(!localContentEnabled(request.headers.get("host")))return false;
 const site=request.headers.get("sec-fetch-site");if(site&&!["same-origin","none"].includes(site))return false;
 const origin=request.headers.get("origin");if(!origin)return true;
 try{const parsed=new URL(origin);return parsed.host===request.headers.get("host")&&["http:","https:"].includes(parsed.protocol);}catch{return false;}
}
