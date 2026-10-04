import 'server-only';
import { shopifyAdminGraphQL } from '@/lib/shopify/client';
import { CHECK_CONFIGS, MODULE_CENTS, quote, type Counts } from './pricing';
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
 const missing=['read_discounts','write_discounts','read_products'].filter(s=>!scopes.includes(s));
 if(missing.length) throw new Error('Shopify connection needs discount permissions. Reconnect after enabling read_discounts, write_discounts and read_products.');
 if(!process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) throw new Error('Shopify checkout verification needs a Storefront API token.');
 const catalog=await shopifyAdminGraphQL<{products:{pageInfo:{hasNextPage:boolean};nodes:{variants:{pageInfo:{hasNextPage:boolean};nodes:{id:string;price:string}[]}}[]}}>('query { products(first:100,query:"status:active") { pageInfo{hasNextPage} nodes { variants(first:100){pageInfo{hasNextPage} nodes{id price}} } } }');
 const known=new Map<string,number>(Object.values(FABRICS).flatMap(f=>(Object.keys(f) as (keyof Counts)[]).map(k=>[`gid://shopify/ProductVariant/${f[k]}`,MODULE_CENTS[k]] as const)));
 if(catalog.products.pageInfo.hasNextPage)throw new Error('Catalog eligibility needs review before an order-wide sale.');
 for(const p of catalog.products.nodes){
  if(p.variants.pageInfo.hasNextPage)throw new Error('Catalog eligibility needs review.');
  for(const v of p.variants.nodes){
   if(!known.has(v.id))throw new Error('This store has other active merchandise. Sale eligibility needs review before using an order-wide discount.');
   if(Math.round(Number(v.price)*100)!==known.get(v.id))throw new Error('Shopify module prices changed. Refresh the sale pricing configuration.');
  }
 }
 if(process.env.SALE_STOREFRONT_BRIDGE_VERSION !== '1') throw new Error('Website sale connection must be installed and verified before starting a sale.');
}
export async function setShopifySale(sale:SaleState, enabled:boolean) {
 const input={title:TITLE, startsAt:enabled ? sale.starts_at : new Date(Date.now()-60000).toISOString(), endsAt:enabled ? sale.ends_at : new Date().toISOString(),
  customerGets:{value:{percentage:0.35},items:{all:true}},
  minimumRequirement:{quantity:{greaterThanOrEqualToQuantity:'1'}},
  combinesWith:{productDiscounts:true,orderDiscounts:false,shippingDiscounts:false}};
 const existing=sale.shopify_discount_id;
 if(existing) {
  const own=await shopifyAdminGraphQL<{automaticDiscountNode:{automaticDiscount:{title?:string}}|null}>(
   'query($id:ID!){automaticDiscountNode(id:$id){automaticDiscount{... on DiscountAutomaticBasic{title}}}}',{id:existing});
  if(own.automaticDiscountNode?.automaticDiscount.title!==TITLE) throw new Error('Managed Shopify discount could not be verified.');
 }
 if(!enabled && !existing) return null;
 const operation=existing ? 'discountAutomaticBasicUpdate' : 'discountAutomaticBasicCreate';
 const result=await shopifyAdminGraphQL<Record<string,{automaticDiscountNode:{id:string}|null;userErrors:ErrorItem[]}>>(
  `mutation($input:DiscountAutomaticBasicInput!${existing?', $id:ID!':''}) { ${operation}(${existing?'id:$id, ':''}automaticBasicDiscount:$input) { automaticDiscountNode{id} userErrors{message} } }`,
  {input,...(existing?{id:existing}:{})});
 const output=result[operation];
 if(output.userErrors.length || !output.automaticDiscountNode) throw new Error(output.userErrors.map(e=>e.message).join('; ') || 'Shopify did not confirm the discount');
 return output.automaticDiscountNode.id;
}
export async function checkoutQuote(counts:Counts, fabric:string) {
 const variants=FABRICS[fabric];
 if(!variants) throw new Error('Invalid fabric');
 const domain=process.env.SHOPIFY_STORE_DOMAIN;
 if(!domain || !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(domain)) throw new Error('Invalid Shopify store configuration');
 const token=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
 if(!token) throw new Error('Checkout verification is not configured');
 const response=await fetch(`https://${domain}/api/2025-10/graphql.json`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query:
  `mutation($input:CartInput!){cartCreate(input:$input){cart{checkoutUrl cost{subtotalAmount{amount currencyCode}} lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}}}}} userErrors{message}}}`,
  variables:{input:{buyerIdentity:{countryCode:'CA'},lines:(Object.keys(counts) as (keyof Counts)[]).filter(k=>counts[k]>0).map(k=>({quantity:counts[k],merchandiseId:`gid://shopify/ProductVariant/${variants[k]}`}))}}})});
 const body=await response.json();
 const result=body.data?.cartCreate;
 if(!response.ok || body.errors?.length || result?.userErrors?.length || !result?.cart) throw new Error('Shopify could not verify this configuration.');
 const cart=result.cart;
 if(cart.cost.subtotalAmount.currencyCode!=='CAD') throw new Error('Checkout currency mismatch');
 // Sold-out/invalid variants must not silently disappear from a verification cart.
 const lines=cart.lines.nodes;
 for(const key of Object.keys(counts) as (keyof Counts)[]) {
  if(counts[key] && !lines.some((l:{quantity:number;merchandise:{id:string}})=>l.merchandise.id===`gid://shopify/ProductVariant/${variants[key]}` && l.quantity===counts[key])) throw new Error('Shopify changed the requested configuration');
 }
 return {checkoutUrl:cart.checkoutUrl as string,totalCents:Math.round(Number(cart.cost.subtotalAmount.amount)*100)};
}
export async function verifySalePrices(active:boolean) {
 for(const counts of CHECK_CONFIGS) {
  await Promise.all(Object.keys(FABRICS).map(async fabric => {
   const actual=await checkoutQuote(counts,fabric);
   const expected=quote(counts,active).totalCents;
   if(actual.totalCents!==expected) throw new Error(`Checkout mismatch for ${fabric}, ${quote(counts,active).pieces} modules: expected ${(expected/100).toFixed(2)}, received ${(actual.totalCents/100).toFixed(2)} CAD. Sale remains unavailable.`);
  }));
 }
}
