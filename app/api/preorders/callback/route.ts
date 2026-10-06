import { NextResponse, type NextRequest } from 'next/server';
import { canSyncShopifyOrders, getUserContext } from '@/lib/auth';
import { connectPreorderApp, preorderAppConfig } from '@/lib/preorders/connection';
import { verifyPreorderCallback } from '@/lib/preorders/oauth';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
 const {user,profile}=await getUserContext();
 if(!user||!canSyncShopifyOrders(profile?.role))return NextResponse.json({error:'Not authorized'},{status:403});
 let connected=false;
 try {
  const config=preorderAppConfig();
  if(request.nextUrl.origin!==config.origin||!verifyPreorderCallback(config,request.nextUrl.searchParams,request.cookies.get('luun_preorder_oauth_state')?.value))throw new Error('Invalid callback');
  await connectPreorderApp(request.nextUrl.searchParams.get('code')!,user.id);
  connected=true;
 }catch{ /* Never expose authorization codes, signatures or API errors. */ }
 const destination=new URL('/data',request.url);
 destination.searchParams.set('preorders',connected?'connected':'connection_failed');
 const response=NextResponse.redirect(destination);
 response.cookies.set('luun_preorder_oauth_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/preorders',maxAge:0});
 return response;
}
