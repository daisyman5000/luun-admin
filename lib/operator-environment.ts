export const operatorProjectReference='pgoxvqziybtasivqiymw';
export type OperatorEnvironment={configured:boolean;projectMatches:boolean;publicKeyValid:boolean;reason:string};
export function inspectOperatorEnvironment(environment:Record<string,string|undefined>):OperatorEnvironment{
 const result={configured:false,projectMatches:false,publicKeyValid:false,reason:'Workspace connection is not configured.'};
 const raw=environment.NEXT_PUBLIC_SUPABASE_URL;
 if(!raw)return result;
 try{const url=new URL(raw);result.projectMatches=url.protocol==='https:'&&url.hostname===operatorProjectReference+'.supabase.co'&&!url.username&&!url.password&&!url.port&&(url.pathname==='/'||url.pathname==='')&&!url.search&&!url.hash;}catch{return {...result,reason:'Workspace project URL is invalid.'};}
 if(!result.projectMatches)return {...result,reason:'Workspace configuration does not match the confirmed Supabase project.'};
 const key=environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||environment.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 if(key.startsWith('sb_publishable_')&&key.length>20)result.publicKeyValid=true;
 else if(key.split('.').length===3){try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));result.publicKeyValid=payload.role==='anon'&&(!payload.ref||payload.ref===operatorProjectReference);}catch{/* Invalid public credential remains unavailable. */}}
 if(!result.publicKeyValid)return {...result,reason:'An existing publishable key or legacy anon key is required; a service-role key must not be used.'};
 return {...result,configured:true,reason:'Confirmed project URL and public-key configuration are present. Sign-in and schema access still require verification.'};
}
