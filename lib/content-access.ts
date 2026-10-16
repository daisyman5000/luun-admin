import { inspectOperatorEnvironment } from './operator-environment';
import { getUserContext } from '@/lib/auth';
import { localContentEnabled } from './local-content';
import { canReadOperatorContext } from './content-permissions';
import { createOperatorDatabase } from './content-database';
export async function operatorAccess(request:Request){
 if(localContentEnabled(request.headers.get('host')))return {kind:'local' as const};
 if(!inspectOperatorEnvironment(process.env).configured)return {kind:'denied' as const,status:503};
 try{const context=await getUserContext();if(!context.user)return {kind:'denied' as const,status:401};if(!canReadOperatorContext(context.profile?.role))return {kind:'denied' as const,status:403};return {kind:'database' as const,role:context.profile!.role,databaseClient:context.supabase,store:createOperatorDatabase(context.supabase)};}catch{return {kind:'denied' as const,status:503};}
}
export {validWorkspaceJsonOrigin as validOperatorOrigin} from './workspace-request';
