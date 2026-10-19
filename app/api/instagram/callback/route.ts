import {NextResponse,type NextRequest} from 'next/server';
import {consumeOAuthCallback,INSTAGRAM_CALLBACK} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
import {oauthFailure,OAUTH_DIAGNOSTIC_COOKIE,type OAuthStage,type OAuthFailure} from '@/lib/instagram/oauth-diagnostics';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 let target='/content?instagram=failed',origin=new URL(INSTAGRAM_CALLBACK).origin;
 let stage:OAuthStage='owner',verifiedOwner=false,failure:OAuthFailure|null=null;
 try{const actor=await instagramOwner();verifiedOwner=true;stage='configuration';const s=instagramServer(),params=request.nextUrl.searchParams;origin=new URL(s.config.redirectUri).origin;stage='callback_origin';if(request.nextUrl.origin!==new URL(s.config.redirectUri).origin)throw Error();
  stage='state_validation';const code=await consumeOAuthCallback(params,request.cookies.get('luun_instagram_state')?.value,actor,(hash,user)=>s.rpc<boolean>('consume_instagram_oauth_attempt',{p_hash:hash,p_actor:user}));
  const connection=await s.api.exchange(code,value=>{stage=value;});stage='connection_storage';await s.storeConnection(connection);target='/content?instagram=connected';
 }catch(error){if(verifiedOwner)failure=oauthFailure(stage,error);}
 const response=NextResponse.redirect(new URL(target,origin),303);for(const [k,v] of Object.entries(instagramHeaders))response.headers.set(k,v);response.cookies.set('luun_instagram_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/instagram',maxAge:0});
 if(verifiedOwner)response.cookies.set(OAUTH_DIAGNOSTIC_COOKIE,failure?JSON.stringify(failure):'',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/instagram',maxAge:failure?600:0});return response;
}
