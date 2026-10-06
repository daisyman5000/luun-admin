import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { canSyncShopifyOrders, getUserContext } from '@/lib/auth';
import { preorderAppConfig } from '@/lib/preorders/connection';
import { preorderAuthorizeUrl } from '@/lib/preorders/oauth';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
 const {user,profile}=await getUserContext();
 if(!user)return NextResponse.redirect(new URL('/login',request.url));
 if(!canSyncShopifyOrders(profile?.role))return NextResponse.json({error:'Not authorized'},{status:403});
 try {
  const config=preorderAppConfig();
  if(request.nextUrl.origin!==config.origin)return NextResponse.json({error:'Use the production admin to connect preorders'},{status:400});
  const state=randomBytes(32).toString('hex');
  const response=NextResponse.redirect(preorderAuthorizeUrl(config,state));
  response.cookies.set('luun_preorder_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/preorders',maxAge:600});
  return response;
 }catch{return NextResponse.json({error:'Preorder connection is not configured'},{status:503});}
}
