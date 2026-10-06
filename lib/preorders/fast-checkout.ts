import {createHash,randomUUID} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {FABRICS} from '@/lib/sales/shopify';
import {MODULE_CENTS,quote,quantityRate,saleBasisPoints,validateCounts,type Counts} from '@/lib/sales/pricing';
import {preorderAppConfig} from './connection';

const keys=['corner','armless','ottoman'] as const;
export async function fastCheckout(body:Record<string,unknown>,ip:string){
 const started=Date.now();
 const supplied=validateCounts(body.counts);
 const counts:Counts={corner:supplied.corner,armless:supplied.armless,ottoman:supplied.ottoman};
 const fabric=String(body.fabric||'');const variants=FABRICS[fabric];
 if(!variants||typeof body.preorder!=='boolean'||!Number.isSafeInteger(body.expectedTotalCents))throw Error('Invalid checkout configuration.');
 const preorder=body.preorder,expected=body.expectedTotalCents as number;
 const regular=quote(counts,false),sale=quote(counts,true);
 if(expected!==regular.totalCents&&expected!==sale.totalCents)throw Error('Pricing changed. Review the updated total before checkout.');
 const active=expected===sale.totalCents,pieces=counts.corner+counts.armless+counts.ottoman;
 const bps=active?saleBasisPoints(pieces):Math.round(quantityRate(pieces)*10000);
 const plan=preorder?String(body.planId||''):null;
 if(preorder&&!/^gid:\/\/shopify\/SellingPlan\/[0-9]+$/.test(plan!))throw Error('Preorder payment terms are not ready. Please refresh.');
 const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
 if(!domain||!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(domain)||!token)throw Error('Checkout is not configured.');
 const reservationId=randomUUID();
 const response=await fetch(`https://${domain}/api/2026-01/graphql.json`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token,'Shopify-Storefront-Buyer-IP':ip},body:JSON.stringify({
  query:`mutation($input:CartInput!){cartCreate(input:$input){cart{id checkoutUrl discountAllocations{discountedAmount{amount currencyCode}} cost{checkoutChargeAmount{amount currencyCode} subtotalAmount{amount currencyCode}} lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}} sellingPlanAllocation{sellingPlan{id} checkoutChargeAmount{amount currencyCode}}}}} userErrors{message}}}`,
  variables:{input:{buyerIdentity:{countryCode:'CA'},attributes:[{key:'Luun reservation',value:reservationId},{key:'Luun payment option',value:preorder?'20% deposit; balance manually collected when complete sofa is available':'Full payment'}],lines:keys.filter(k=>counts[k]>0).map(k=>({quantity:counts[k],merchandiseId:`gid://shopify/ProductVariant/${variants[k]}`,...(preorder?{sellingPlanId:plan}:{})}))}}
 })});
 const payload=await response.json(),cart=payload.data?.cartCreate?.cart,shopifyMs=Date.now()-started;
 if(!response.ok||payload.errors?.length||payload.data?.cartCreate?.userErrors?.length||!cart)throw Error('Shopify could not open checkout. Please try again.');
 if(!cart.id||cart.cost.subtotalAmount.currencyCode!=='CAD')throw Error('Checkout currency differs.');
 if(cart.lines.nodes.length!==keys.filter(k=>counts[k]>0).length)throw Error('Shopify changed the configuration.');
 for(const k of keys){
  if(!counts[k])continue;
  const line=cart.lines.nodes.find((item:{merchandise:{id:string}})=>item.merchandise.id===`gid://shopify/ProductVariant/${variants[k]}`);
  if(!line||line.quantity!==counts[k]||(preorder?line.sellingPlanAllocation?.sellingPlan.id!==plan:!!line.sellingPlanAllocation))throw Error('Shopify changed the payment option or configuration.');
  if(preorder){const charge=line.sellingPlanAllocation.checkoutChargeAmount;
   if(charge?.currencyCode!=='CAD'||Math.round(Number(charge.amount)*100)!==Math.round(MODULE_CENTS[k]*(10000-bps)/50000))throw Error('The deposit amount could not be confirmed.');
  }
 }
 const discounts=cart.discountAllocations.reduce((sum:number,item:{discountedAmount:{amount:string;currencyCode:string}})=>{
  if(item.discountedAmount.currencyCode!=='CAD')throw Error('Discount currency differs.');
  return sum+Math.round(Number(item.discountedAmount.amount)*100);
 },0);
 const totalCents=Math.round(Number(cart.cost.subtotalAmount.amount)*100)-discounts;
 if(totalCents!==expected)throw Error('Shopify pricing changed. Review the updated total before checkout.');
 const depositCents=preorder?keys.reduce((sum,k)=>sum+counts[k]*Math.round(MODULE_CENTS[k]*(10000-bps)/50000),0):totalCents;
 if(preorder&&(cart.cost.checkoutChargeAmount?.currencyCode!=='CAD'||Math.round(Number(cart.cost.checkoutChargeAmount.amount)*100)!==depositCents))throw Error('The amount due at checkout could not be confirmed.');
 const config=preorderAppConfig();
 const confirmed=await createAdminClient().rpc('confirm_luun_checkout',{
  reservation_input:reservationId,fabric_input:fabric,counts_input:counts,cart_input:cart.id,
  preorder_input:preorder,total_input:totalCents,plan_input:plan,shop_input:config.shop,client_input:config.clientId,
  rate_key_input:createHash('sha256').update('luun-preorder:'+ip).digest('hex')
 });
 if(confirmed.error||!confirmed.data)throw Error('Inventory could not be confirmed. Please try again.');
 if(confirmed.data.error)throw Error(confirmed.data.error);
 return {cart:{checkoutUrl:cart.checkoutUrl,totalCents,depositCents,preorder,eta:confirmed.data.eta,cartId:cart.id,expiresAt:Date.now()+90*60000},timing:`shopify;dur=${shopifyMs},confirm;dur=${Date.now()-started-shopifyMs}`};
}
