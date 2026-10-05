import {createHash,randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {allowedStorefront,headersFor} from '@/lib/sales/public-headers';
import {FABRICS} from '@/lib/sales/shopify';
import {quote,validateCounts,type Counts} from '@/lib/sales/pricing';
import {readSale} from '@/lib/sales/store';
import {isSaleActive} from '@/lib/sales/types';

export const dynamic='force-dynamic';
const PLAN='gid://shopify/SellingPlan/698922762519';
const keys=['corner','armless','ottoman'] as const;
const confirmedContainers=new Set(['MT-LUUN-007','MT-LUUN-008']);
function fabricKey(value:string){
 const key=value.toLowerCase().trim().replace(/[\s_]+/g,'-');
 return ({white:'off-white',offwhite:'off-white','dark-gray':'dark-grey',grey:'dark-grey',gray:'dark-grey'} as Record<string,string>)[key]||key;
}
async function supply(){
 const db=createAdminClient();
 const [stock,containers]=await Promise.all([
  db.from('inventory').select('fabric_slug,module_slug,available_qty,reserved_qty').eq('builder_visible',true),
  db.from('container_entries').select('id,container_number,status,eta,manifest_json')
 ]);
 if(stock.error||containers.error)throw new Error('Inventory could not be confirmed. Please try again.');
 const current:Record<string,Counts>={},total:Record<string,Counts>={};
 for(const fabric of Object.keys(FABRICS)){current[fabric]={corner:0,armless:0,ottoman:0};total[fabric]={corner:0,armless:0,ottoman:0};}
 for(const row of stock.data||[]){
  const fabric=fabricKey(row.fabric_slug||'');const key=row.module_slug as keyof Counts;
  if(!current[fabric]||!keys.includes(key))continue;
  const amount=Math.max(0,Number(row.available_qty||0)-Number(row.reserved_qty||0));
  if(!Number.isSafeInteger(amount))throw new Error('Inventory needs review.');
  current[fabric][key]+=amount;total[fabric][key]+=Number(row.available_qty||0)-Number(row.reserved_qty||0);
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const shipments=(containers.data||[]).filter(row=>
  (['production','in_transit'].includes(row.status)||confirmedContainers.has(row.container_number)&&row.status==='planning')
  &&row.eta&&row.eta>=today&&Array.isArray(row.manifest_json)
 ).sort((a,b)=>a.eta.localeCompare(b.eta));
 for(const row of shipments)for(const item of row.manifest_json){
  const fabric=fabricKey(item.color||'');const key=item.module as keyof Counts;
  if(!total[fabric]||!keys.includes(key))continue;
  if(!Number.isSafeInteger(item.quantity)||item.quantity<0)throw new Error('Purchase order inventory needs review.');
  total[fabric][key]+=item.quantity;
 }
 for(const fabric of Object.keys(total))for(const key of keys)total[fabric][key]=Math.max(0,total[fabric][key]);
 return {current,total,shipments};
}
export async function OPTIONS(r:Request){return new Response(null,{status:204,headers:headersFor(r)});}
export async function GET(r:Request){
 const headers=headersFor(r);
 try{const data=await supply();return NextResponse.json({...data.total,__preorder:{current:data.current,shipments:data.shipments.map(row=>({id:row.id,eta:row.eta,items:row.manifest_json}))}},{headers});}
 catch{return NextResponse.json({error:'Inventory unavailable'},{status:503,headers});}
}
export async function POST(r:Request){
 const headers=headersFor(r);
 if(!allowedStorefront(r))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 if(process.env.LUUN_DOWNPAY_ENABLED!=='1')return NextResponse.json({error:'Preorder checkout is being connected. Please contact support.'},{status:503,headers});
 try{
  const ip=r.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if(!ip)throw new Error('Checkout request could not be verified.');
  const limit=await createAdminClient().rpc('claim_sale_checkout_request',{key_hash_input:createHash('sha256').update('luun-preorder:'+ip).digest('hex')});
  if(limit.error||limit.data!==true)return NextResponse.json({error:'Please wait a minute before retrying.'},{status:429,headers});
  const body=await r.json();const counts=validateCounts(body.counts);const fabric=fabricKey(String(body.fabric||''));
  const variants=FABRICS[fabric];if(!variants)throw new Error('Choose a valid fabric.');
  const data=await supply();
  if(keys.some(key=>counts[key]>data.total[fabric][key]))throw new Error('This configuration exceeds available and incoming inventory.');
  const preorder=keys.some(key=>counts[key]>data.current[fabric][key]);
  if(!preorder)throw new Error('This sofa is in stock. Refresh to use full-payment checkout.');
  const sale=await readSale();const active=isSaleActive(sale);
  const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if(!domain||!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(domain)||!token)throw new Error('Checkout is not configured.');
  const reservationId=randomUUID();
  const response=await fetch(`https://${domain}/api/2026-01/graphql.json`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query:
   `mutation($input:CartInput!){cartCreate(input:$input){cart{id checkoutUrl discountAllocations{discountedAmount{amount currencyCode}} cost{subtotalAmount{amount currencyCode}} lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}} sellingPlanAllocation{sellingPlan{id}}}}} userErrors{message}}}`,
   variables:{input:{buyerIdentity:{countryCode:'CA'},attributes:[{key:'Luun reservation',value:reservationId},{key:'Luun payment option',value:'20% deposit; balance manually collected when complete sofa is available'}],lines:keys.filter(key=>counts[key]>0).map(key=>({quantity:counts[key],merchandiseId:`gid://shopify/ProductVariant/${variants[key]}`,sellingPlanId:PLAN}))}}})});
  const result=await response.json();const cart=result.data?.cartCreate?.cart;
  if(!response.ok||result.errors?.length||result.data?.cartCreate?.userErrors?.length||!cart)throw new Error('Shopify could not create the deposit checkout. Please contact support.');
  if(cart.cost.subtotalAmount.currencyCode!=='CAD')throw new Error('Checkout currency differs.');
  for(const key of keys)if(counts[key]&&!cart.lines.nodes.some((line:{quantity:number;merchandise:{id:string};sellingPlanAllocation?:{sellingPlan:{id:string}}})=>line.quantity===counts[key]&&line.merchandise.id===`gid://shopify/ProductVariant/${variants[key]}`&&line.sellingPlanAllocation?.sellingPlan.id===PLAN))throw new Error('Shopify changed the sofa or deposit option.');
  const discounts=cart.discountAllocations.reduce((sum:number,item:{discountedAmount:{amount:string;currencyCode:string}})=>{if(item.discountedAmount.currencyCode!=='CAD')throw new Error('Discount currency differs.');return sum+Math.round(Number(item.discountedAmount.amount)*100);},0);
  const totalCents=Math.round(Number(cart.cost.subtotalAmount.amount)*100)-discounts;
  if(totalCents!==quote(counts,active).totalCents)throw new Error('Deposit checkout pricing differs from your configuration. Please contact support.');
  const latest=await readSale();if(latest.version!==sale.version||isSaleActive(latest)!==active)throw new Error('Sale pricing changed. Please refresh.');
  const reservation=await createAdminClient().rpc('claim_preorder_inventory',{reservation_id:reservationId,fabric_input:fabric,counts_input:counts,cart_input:cart.id});
  if(reservation.error||reservation.data!==true)throw new Error('This inventory was just reserved. Please refresh your configuration.');
  return NextResponse.json({checkoutUrl:cart.checkoutUrl,totalCents,preorder:true},{headers});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Checkout unavailable'},{status:409,headers});}
}
