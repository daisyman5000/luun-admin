import {NextResponse} from 'next/server';
import {validOperatorOrigin} from '@/lib/content-access';
import {authorizeUrl,newOAuthState,sha256} from '@/lib/instagram/core';
import {instagramHeaders,instagramOwner,instagramServer} from '@/lib/instagram/server';
export const runtime='nodejs';
export async function POST(request:Request){if(!validOperatorOrigin(request))return Response.json({error:'Use the signed-in calendar.'},{status:403,headers:instagramHeaders});try{const actor=await instagramOwner(),s=instagramServer(),state=newOAuthState();const {error}=await s.db.from('instagram_oauth_attempts').insert({state_hash:sha256(state),actor,expires_at:new Date(Date.now()+600000).toISOString()});if(error)throw Error();const response=NextResponse.json({authorizeUrl:authorizeUrl(s.config,state)},{headers:instagramHeaders});response.cookies.set('luun_instagram_state',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/instagram',maxAge:600});return response;}catch{return Response.json({error:'Instagram setup or owner/admin sign-in is required.'},{status:503,headers:instagramHeaders});}}
