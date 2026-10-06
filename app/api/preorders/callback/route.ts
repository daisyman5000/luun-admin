import { NextResponse, type NextRequest } from 'next/server';
import { canSyncShopifyOrders, getUserContext } from '@/lib/auth';
import { connectPreorderApp, preorderAppConfig } from '@/lib/preorders/connection';
import { verifyPreorderCallback } from '@/lib/preorders/oauth';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
 const {user,profile}=await getUserContext();
 if(!user||!canSyncShopifyOrders(profile?.role))return NextResponse.json({error:'Not authorized'},{status:403});
 let connected=false;
 let reason='configuration';
 try {
  const config=preorderAppConfig();
  reason='origin';
  if(request.nextUrl.origin!==config.origin)throw new Error('Invalid origin');
  reason='shop';
  if(request.nextUrl.searchParams.get('shop')!==config.shop)throw new Error('Invalid shop');
  reason='state';
  const expected=request.cookies.get('luun_preorder_oauth_state')?.value;
  if(!expected||request.nextUrl.searchParams.get('state')!==expected)throw new Error('Invalid state');
  reason='signature';
  if(!verifyPreorderCallback(config,request.nextUrl.searchParams,expected))throw new Error('Invalid callback');
  reason='token_exchange';
  try{await connectPreorderApp(request.nextUrl.searchParams.get('code')!,user.id);}
  catch(error){
   const message=error instanceof Error?error.message:'';
   if(message==='Preorder permissions are incomplete')reason='permissions';
   if(message==='Unable to save preorder connection')reason='storage';
   throw error;
  }
  connected=true;
 }catch{console.warn('[preorders:oauth] connection rejected',{phase:reason});}
 const destination=new URL('/data',request.url);
 destination.searchParams.set('preorders',connected?'connected':'connection_failed');
 if(!connected)destination.searchParams.set('preorder_reason',reason);
 const response=NextResponse.redirect(destination);
 response.cookies.set('luun_preorder_oauth_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/preorders',maxAge:0});
 return response;
}
