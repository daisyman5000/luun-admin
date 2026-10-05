import 'server-only';
import {randomUUID} from 'node:crypto';
import { shopifyAdminGraphQL } from '@/lib/shopify/client';
import { CHECK_CONFIGS, MODULE_CENTS, SALE_TIERS, quote, type Counts } from './pricing';
import type { SaleState } from './types';
type ErrorItem = { message: string };
const TITLE = 'Luun managed extra 35% sale';
export const FABRICS: Record<string, Record<keyof Counts, string>> = {
 jade:{corner:'53545307439383',armless:'53545307504919',ottoman:'53545308520727'},
 aqua:{corner:'53545313435927',armless:'53545313370391',ottoman:'53545312846103'},
 peach:{corner:'53545318416663',armless:'53545318285591',ottoman:'53545318220055'},
 'dark-grey':{corner:'53518333280535',armless:'53518332002583',ottoman:'53518334099735'},
 'off-white':{corner:'53518283735319',armless:'53518319485207',ottoman:'53518317486359'}
};
export async function salePermissions() {
 const result=await shopifyAdminGraphQL<{currentAppInstallation:{accessScopes:{handle:string}[]}}>('query { currentAppInstallation { accessScopes { handle } } }');
 const scopes=result.currentAppInstallation.accessScopes.map(s=>s.handle);
 // Shopify write scopes also grant read access and can omit the read handle.
 const missing=['write_discounts','read_products'].filter(s=>!scopes.includes(s));
 if(missing.length) throw new Error('Shopify connection needs discount permissions. Reconnect after enabling read_discounts, write_discounts and read_products.');
 if(!process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) throw new Error('Shopify checkout verification needs a Storefront API token.');
 const known=new Map<string,number>(Object.values(FABRICS).flatMap(f=>(Object.keys(f) as (keyof Counts)[]).map(k=>[`gid://shopify/ProductVariant/${f[k]}`,MODULE_CENTS[k]] as const)));
 const catalog=await shopifyAdminGraphQL<{nodes:({id:string;price:string;product:{status:string}}|null)[]}>(
  'query($ids:[ID!]!){nodes(ids:$ids){... on ProductVariant{id price product{status}}}}',{ids:[...known.keys()]});
 if(catalog.nodes.length!==known.size || catalog.nodes.some(v=>!v || v.product.status!=='ACTIVE' || Math.round(Number(v.price)*100)!==known.get(v.id)))throw new Error('Builder module catalog or prices changed. Refresh the sale pricing configuration.');
 if(process.env.SALE_STOREFRONT_BRIDGE_VERSION !== '1') throw new Error('Website sale connection must be installed and verified before starting a sale.');
}
const variantIds=()=>Object.values(FABRICS).flatMap(f=>Object.values(f).map(id=>`gid://shopify/ProductVariant/${id}`));
function discountIds(sale:SaleState):string[]{
 if(!sale.shopify_discount_id)return [];
 const ids=JSON.parse(sale.shopify_discount_id);
 if(!Array.isArray(ids)||ids.length!==SALE_TIERS.length||ids.some(id=>typeof id!=='string'||!id.startsWith('gid://shopify/DiscountAutomaticNode/')))throw new Error('Managed sale discount identifiers need review.');
 return ids;
}
function tierInput(sale:SaleState,index:number,enabled:boolean){
 const tier=SALE_TIERS[index];
 return {title:TITLE+' · '+tier.min+'+ modules',startsAt:enabled?sale.starts_at:new Date(Date.now()-60000).toISOString(),endsAt:enabled?sale.ends_at:new Date().toISOString(),
 customerGets:{value:{percentage:tier.bps/10000},items:{products:{productVariantsToAdd:variantIds()}}},minimumRequirement:{quantity:{greaterThanOrEqualToQuantity:String(tier.min)}},
 combinesWith:{productDiscounts:false,orderDiscounts:false,shippingDiscounts:false}};
}
export async function prepareShopifySale(sale:SaleState){
 const existing=discountIds(sale);if(existing.length)return JSON.stringify(existing);
 const ids:string[]=[];
 // Create expired tiers first. Save all identifiers before activating any tier.
 for(let index=0;index<SALE_TIERS.length;index++){
  const result=await shopifyAdminGraphQL<{discountAutomaticBasicCreate:{automaticDiscountNode:{id:string}|null;userErrors:ErrorItem[]}}>(
   'mutation($input:DiscountAutomaticBasicInput!){discountAutomaticBasicCreate(automaticBasicDiscount:$input){automaticDiscountNode{id} userErrors{message}}}',{input:tierInput(sale,index,false)});
  const out=result.discountAutomaticBasicCreate;
  if(out.userErrors.length||!out.automaticDiscountNode)throw new Error(out.userErrors.map(e=>e.message).join('; ')||'Shopify did not confirm the module tier');
  ids.push(out.automaticDiscountNode.id);
 }
 return JSON.stringify(ids);
}
export async function setShopifySale(sale:SaleState,enabled:boolean){
 const ids=discountIds(sale);if(!ids.length){if(enabled)throw new Error('Prepare module tiers before activating');return null;}
 const errors:string[]=[];
 for(let index=0;index<ids.length;index++){
  try{
   const own=await shopifyAdminGraphQL<{automaticDiscountNode:{automaticDiscount:{title?:string}}|null}>(
    'query($id:ID!){automaticDiscountNode(id:$id){automaticDiscount{... on DiscountAutomaticBasic{title}}}}',{id:ids[index]});
   if(own.automaticDiscountNode?.automaticDiscount.title!==TITLE+' · '+SALE_TIERS[index].min+'+ modules')throw new Error('Managed module discount could not be verified');
   const result=await shopifyAdminGraphQL<{discountAutomaticBasicUpdate:{automaticDiscountNode:{id:string}|null;userErrors:ErrorItem[]}}>(
    'mutation($id:ID!,$input:DiscountAutomaticBasicInput!){discountAutomaticBasicUpdate(id:$id,automaticBasicDiscount:$input){automaticDiscountNode{id} userErrors{message}}}',{id:ids[index],input:tierInput(sale,index,enabled)});
   if(result.discountAutomaticBasicUpdate.userErrors.length)throw new Error(result.discountAutomaticBasicUpdate.userErrors.map(e=>e.message).join('; '));
  }catch(e){errors.push((e as Error).message);if(enabled)break;}
 }
 if(errors.length)throw new Error(errors.join('; '));return JSON.stringify(ids);
}
export async function checkoutQuote(counts:Counts, fabric:string,discountCodes:string[]=[]) {
 const variants=FABRICS[fabric];
 if(!variants) throw new Error('Invalid fabric');
 const domain=process.env.SHOPIFY_STORE_DOMAIN;
 if(!domain || !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(domain)) throw new Error('Invalid Shopify store configuration');
 const token=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
 if(!token) throw new Error('Checkout verification is not configured');
 const response=await fetch(`https://${domain}/api/2025-10/graphql.json`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query:
  `mutation($input:CartInput!){cartCreate(input:$input){cart{checkoutUrl discountCodes{code applicable} cost{subtotalAmount{amount currencyCode}} discountAllocations{discountedAmount{amount currencyCode}} lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}}}}} userErrors{message}}}`,
  variables:{input:{discountCodes,buyerIdentity:{countryCode:'CA'},lines:(Object.keys(counts) as (keyof Counts)[]).filter(k=>counts[k]>0).map(k=>({quantity:counts[k],merchandiseId:`gid://shopify/ProductVariant/${variants[k]}`}))}}})});
 const body=await response.json();
 const result=body.data?.cartCreate;
 if(!response.ok || body.errors?.length || result?.userErrors?.length || !result?.cart) throw new Error('Shopify could not verify this configuration.');
 const cart=result.cart;
 if(discountCodes.some(code=>!cart.discountCodes.some((d:{code:string;applicable:boolean})=>d.code.toLowerCase()===code.toLowerCase()&&d.applicable)))throw new Error('Shopify did not apply the isolated module verification discount');
 if(cart.cost.subtotalAmount.currencyCode!=='CAD') throw new Error('Checkout currency mismatch');
 // Sold-out/invalid variants must not silently disappear from a verification cart.
 const lines=cart.lines.nodes;
 for(const key of Object.keys(counts) as (keyof Counts)[]) {
  if(counts[key] && !lines.some((l:{quantity:number;merchandise:{id:string}})=>l.merchandise.id===`gid://shopify/ProductVariant/${variants[key]}` && l.quantity===counts[key])) throw new Error('Shopify changed the requested configuration');
 }
 // Subtotal includes product discounts but excludes cart-level order discounts.
 const orderDiscountCents=(cart.discountAllocations||[]).reduce((sum:number,a:{discountedAmount:{amount:string;currencyCode:string}})=>{
  if(a.discountedAmount.currencyCode!=='CAD')throw new Error('Checkout discount currency mismatch');
  return sum+Math.round(Number(a.discountedAmount.amount)*100);
 },0);
 return {checkoutUrl:cart.checkoutUrl as string,totalCents:Math.round(Number(cart.cost.subtotalAmount.amount)*100)-orderDiscountCents};
}
export async function verifySalePrices(active:boolean,codes:Map<number,string>=new Map()) {
 for(const counts of CHECK_CONFIGS) {
  await Promise.all(Object.keys(FABRICS).map(async fabric => {
   const tier=[...SALE_TIERS].reverse().find(t=>t.min<=quote(counts,active).pieces)!;
   const code=codes.get(tier.min);
   const actual=await checkoutQuote(counts,fabric,code?[code]:[]);
   const expected=quote(counts,active).totalCents;
   if(actual.totalCents!==expected) throw new Error(`Checkout mismatch for ${fabric}, ${quote(counts,active).pieces} modules: expected ${(expected/100).toFixed(2)}, received ${(actual.totalCents/100).toFixed(2)} CAD. Sale remains unavailable.`);
  }));
 }
}

export async function verifyModuleSalePrices(){
 const codes=new Map<number,string>(),ids:string[]=[];
 try{
  for(let index=0;index<SALE_TIERS.length;index++){
   const code='LUUN-VERIFY-'+randomUUID().replace(/-/g,'');
   const template=tierInput({} as SaleState,index,false);
   const input={...template,title:'Luun isolated module check '+SALE_TIERS[index].min,code,customerSelection:{all:true},usageLimit:1,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+10*60000).toISOString()};
   const result=await shopifyAdminGraphQL<{discountCodeBasicCreate:{codeDiscountNode:{id:string}|null;userErrors:ErrorItem[]}}>(
    'mutation($input:DiscountCodeBasicInput!){discountCodeBasicCreate(basicCodeDiscount:$input){codeDiscountNode{id} userErrors{message}}}',{input});
   const out=result.discountCodeBasicCreate;
   if(out.userErrors.length||!out.codeDiscountNode)throw new Error(out.userErrors.map(e=>e.message).join('; ')||'Shopify did not confirm isolated verification');
   codes.set(SALE_TIERS[index].min,code);ids.push(out.codeDiscountNode.id);
  }
  await verifySalePrices(true,codes);
 }finally{
  // These unpublished, single-use codes expire automatically even if cleanup fails.
  const ended=await Promise.allSettled(ids.map(id=>shopifyAdminGraphQL<{discountCodeBasicUpdate:{userErrors:ErrorItem[]}}>(
   'mutation($id:ID!,$input:DiscountCodeBasicInput!){discountCodeBasicUpdate(id:$id,basicCodeDiscount:$input){userErrors{message}}}',{id,input:{endsAt:new Date().toISOString()}}).then(r=>{if(r.discountCodeBasicUpdate.userErrors.length)throw new Error('Verification code expiry failed');})));
  if(ended.some(r=>r.status==='rejected'))throw new Error('Isolated verification code cleanup needs attention; codes expire within ten minutes. Website sale remains off.');
 }
}
