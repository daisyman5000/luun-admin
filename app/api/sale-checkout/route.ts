import {createHash} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {NextResponse} from 'next/server';
import {readSale} from '@/lib/sales/store';
import {isSaleActive} from '@/lib/sales/types';
import {quote,validateCounts} from '@/lib/sales/pricing';
import {checkoutQuote} from '@/lib/sales/shopify';
import {allowedStorefront,headersFor} from '@/lib/sales/public-headers';
export const dynamic='force-dynamic';
export async function OPTIONS(r:Request){return new Response(null,{status:204,headers:headersFor(r)});}
export async function POST(r:Request){
 const headers=headersFor(r);
 if(!allowedStorefront(r))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 try{
  const ip=r.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if(!ip)throw new Error('Checkout request cannot be verified');
  const key=createHash('sha256').update('luun-sale:'+ip).digest('hex');
  const limit=await createAdminClient().rpc('claim_sale_checkout_request',{key_hash_input:key});
  if(limit.error || limit.data!==true)return NextResponse.json({error:'Please wait a minute before retrying checkout.'},{status:429,headers});
  const body=await r.json();const counts=validateCounts(body.counts);
  const sale=await readSale();
  if(!isSaleActive(sale))throw new Error('Sale changed. Refresh your configuration before checking out.');
  const cart=await checkoutQuote(counts,body.fabric);
  if(cart.totalCents!==quote(counts,true).totalCents)throw new Error('Checkout total differs. Please refresh or contact support.');
  const latest=await readSale();
  if(latest.version!==sale.version || !isSaleActive(latest))throw new Error('Sale changed. Refresh before checking out.');
  return NextResponse.json(cart,{headers});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409,headers});}
}
