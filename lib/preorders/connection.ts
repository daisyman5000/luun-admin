import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { missingPreorderScopes, validatePreorderConfig } from './oauth';
export function preorderAppConfig() {
 return validatePreorderConfig({clientId:process.env.LUUN_PREORDER_CLIENT_ID?.trim()||'',clientSecret:process.env.LUUN_PREORDER_CLIENT_SECRET?.trim()||'',shop:process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase()||'',origin:process.env.LUUN_PREORDER_APP_ORIGIN?.trim()||''});
}
export async function connectPreorderApp(code:string,userId:string) {
 const config=preorderAppConfig();
 const response=await fetch('https://'+config.shop+'/admin/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:config.clientId,client_secret:config.clientSecret,code}),cache:'no-store'});
 if(!response.ok)throw new Error('Preorder token exchange failed');
 const token=await response.json() as {access_token?:string;scope?:string};
 if(!token.access_token||missingPreorderScopes(token.scope||'').length)throw new Error('Preorder permissions are incomplete');
 // Never overwrite the existing order-sync connection.
 const {error}=await createAdminClient().from('preorder_app_connections').upsert({shop_domain:config.shop,client_id:config.clientId,access_token:token.access_token,scope:token.scope,installed_by:userId,updated_at:new Date().toISOString()},{onConflict:'shop_domain,client_id'});
 if(error)throw new Error('Unable to save preorder connection');
}
export async function preorderAdminGraphQL<T>(query:string,variables?:Record<string,unknown>) {
 const config=preorderAppConfig();
 const {data,error}=await createAdminClient().from('preorder_app_connections').select('access_token,scope').eq('shop_domain',config.shop).eq('client_id',config.clientId).maybeSingle();
 if(error||!data?.access_token||missingPreorderScopes(data.scope||'').length)throw new Error('Luun Preorders is not connected');
 const response=await fetch('https://'+config.shop+'/admin/api/2026-10/graphql.json',{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':data.access_token},body:JSON.stringify({query,variables}),cache:'no-store'});
 if(!response.ok)throw new Error('Preorder Shopify API request failed');
 const payload=await response.json() as {data?:T;errors?:{message:string}[]};
 if(!payload.data||payload.errors?.length)throw new Error('Preorder Shopify API returned an error');
 return payload.data;
}
