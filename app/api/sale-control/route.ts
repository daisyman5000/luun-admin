import { NextResponse } from 'next/server';
import { getUserContext,canManageInventory } from '@/lib/auth';
import { auditSale,readSale,updateSale } from '@/lib/sales/store';
import { cleanSale } from '@/lib/sales/types';
import { salePermissions,setShopifySale,verifySalePrices } from '@/lib/sales/shopify';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function context(){try{const c=await getUserContext();if(!c.user || !canManageInventory(c.profile?.role))return null;return c;}catch{return null;}}
export async function GET(){
 if(!await context()) return NextResponse.json({error:'Owner/admin access required'},{status:403});
 try {return NextResponse.json({sale:await readSale()});}catch(e){return NextResponse.json({error:(e as Error).message},{status:503});}
}
export async function POST(request:Request){
 const c=await context();if(!c)return NextResponse.json({error:'Owner/admin access required'},{status:403});
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid request origin'},{status:403});
 let locked:Awaited<ReturnType<typeof readSale>>|null=null;
 let discountId:string|null=null;
 let newlyEnabled=false;
 try {
  const body=await request.json();
  const sale=await readSale();
  const staleLock=sale.status==='syncing' && sale.updated_at && Date.now()-Date.parse(sale.updated_at)>120000;
  if(body.version!==sale.version || (sale.status==='syncing' && !(body.action==='end' && staleLock)))return NextResponse.json({error:'Refresh: another sale update is in progress.'},{status:409});
  if(!['save','start','end'].includes(body.action))return NextResponse.json({error:'Invalid action'},{status:400});
  if(body.action==='save'){
   if(sale.enabled)return NextResponse.json({error:'End the sale before editing its settings.'},{status:409});
   return NextResponse.json({sale:await updateSale(sale.version,cleanSale(body),c.user.id)});
  }
  if(body.action==='start'){
   if(sale.enabled)throw new Error('End the existing sale before starting another.');
   const settings=cleanSale(body);
   if(Date.parse(settings.starts_at)>Date.now())throw new Error('Use Start sale at the chosen start time. Scheduled activation is not enabled yet.');
   if(Date.parse(settings.ends_at)<=Date.now())throw new Error('Sale end must be in the future');
   await salePermissions();
   // Baseline checks detect incompatible quantity discounts or existing promotions before any mutation.
   if(!sale.enabled)await verifySalePrices(false);
   locked=await updateSale(sale.version,{...settings,status:'syncing',enabled:false,last_error:null},c.user.id);
   await auditSale('start_requested',c.user.id,locked.version);
   discountId=await setShopifySale(locked,true);newlyEnabled=true;
   locked=await updateSale(locked.version,{shopify_discount_id:discountId},c.user.id);
   await verifySalePrices(true);
   return NextResponse.json({sale:await updateSale(locked.version,{status:'ready',enabled:true},c.user.id)});
  }
  // Stop website promotion immediately; retry End sale if Shopify deactivation fails.
  locked=await updateSale(sale.version,{enabled:false,status:'syncing',last_error:null},c.user.id);
  await auditSale('end_requested',c.user.id,locked.version);
  await setShopifySale(locked,false);
  return NextResponse.json({sale:await updateSale(locked.version,{status:'off'},c.user.id)});
 }catch(e){
  const message=(e as Error).message;
  let rollbackError='';
  if(newlyEnabled && locked){try{await setShopifySale({...locked,shopify_discount_id:discountId},false);}catch{rollbackError=' Shopify rollback failed; use End sale to retry immediately.';}}
  if(locked){try{await updateSale(locked.version,{enabled:false,status:'error',shopify_discount_id:discountId||locked.shopify_discount_id,last_error:message+rollbackError},c.user.id);}catch{}}
  return NextResponse.json({error:message+rollbackError},{status:503});
 }
}
