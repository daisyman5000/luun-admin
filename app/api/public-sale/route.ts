import { NextResponse } from 'next/server';
import { readSale } from '@/lib/sales/store';
import { isSaleActive } from '@/lib/sales/types';
import { MODULE_CENTS } from '@/lib/sales/pricing';
import {headersFor} from '@/lib/sales/public-headers';
export const dynamic='force-dynamic';
export async function OPTIONS(request:Request){return new Response(null,{status:204,headers:headersFor(request)});}
export async function GET(request:Request){
 try {
  const sale=await readSale();
  if(sale.status==='error' || sale.status==='syncing')throw new Error('Sale updates are not confirmed');
  const active=isSaleActive(sale);
  return NextResponse.json({version:1,active,rate:active?0.35:0,name:active?sale.name:'',announcement:active?sale.announcement:'',deliveryMessage:active?sale.delivery_message:'',endsAt:active?sale.ends_at:null,moduleCents:MODULE_CENTS},{headers:headersFor(request)});
 }catch{return NextResponse.json({error:'Sale availability cannot be confirmed'},{status:503,headers:headersFor(request)});}
}
