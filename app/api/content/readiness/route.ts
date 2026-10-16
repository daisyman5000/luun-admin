import { localContentEnabled } from '@/lib/local-content';
import { inspectOperatorEnvironment } from '@/lib/operator-environment';
import { operatorAccess } from '@/lib/content-access';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(localContentEnabled(request.headers.get('host')))return Response.json({mode:'local',databaseReady:false,automaticActionsEnabled:false,nextStep:'Local mode is active. Database configuration and sign-in have not been enabled.'},{headers});
 const environment=inspectOperatorEnvironment(process.env);
 if(!environment.configured)return Response.json({mode:'unconfigured',databaseReady:false,message:environment.reason,serviceRoleRequired:false},{status:503,headers});
 const access=await operatorAccess(request);
 if(access.kind!=='database')return Response.json({mode:'database',databaseReady:false,nextStep:access.kind==='denied'&&access.status===401?'Sign in with your existing authorized account at /login.':'A known app profile and authorized session are required.',serviceRoleRequired:false},{status:access.kind==='denied'?access.status:503,headers});
 try{await Promise.all([access.store.readPlan(),access.store.listPosts()]);return Response.json({mode:'database',databaseReady:true,role:access.role,serviceRoleRequired:false,publishingConnected:false,automaticActionsEnabled:false},{headers});}catch{return Response.json({mode:'database',databaseReady:false,message:'Authenticated session is present, but operator storage cannot be read. Check the applied schema and session grants; do not reapply migrations automatically.'},{status:503,headers});}
}
