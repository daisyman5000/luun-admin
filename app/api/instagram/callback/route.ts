import {NextResponse,type NextRequest} from 'next/server';
import {consumeOAuthCallback,INSTAGRAM_CALLBACK} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 let target='/content?instagram=failed',origin=new URL(INSTAGRAM_CALLBACK).origin;
 try{const actor=await instagramOwner(),s=instagramServer(),params=request.nextUrl.searchParams;origin=new URL(s.config.redirectUri).origin;if(request.nextUrl.origin!==new URL(s.config.redirectUri).origin)throw Error();
  const code=await consumeOAuthCallback(params,request.cookies.get('luun_instagram_state')?.value,actor,(hash,user)=>s.rpc<boolean>('consume_instagram_oauth_attempt',{p_hash:hash,p_actor:user}));await s.storeConnection(await s.api.exchange(code));target='/content?instagram=connected';
 }catch{/* Never echo OAuth codes, token responses or provider diagnostics. */}
 const response=NextResponse.redirect(new URL(target,origin),303);for(const [k,v] of Object.entries(instagramHeaders))response.headers.set(k,v);response.cookies.set('luun_instagram_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/instagram',maxAge:0});return response;
}
