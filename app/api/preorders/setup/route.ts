import {NextResponse,type NextRequest} from 'next/server';
import {canSyncShopifyOrders,getUserContext} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {FABRICS} from '@/lib/sales/shopify';
import {quantityRate,saleBasisPoints} from '@/lib/sales/pricing';
import {preorderAdminGraphQL,preorderAppConfig} from '@/lib/preorders/connection';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const merchantCode='luun-native-deposit-v1';
const fields='id merchantCode sellingPlans(first:20){nodes{id options billingPolicy{... on SellingPlanFixedBillingPolicy{remainingBalanceChargeTrigger checkoutCharge{type value{... on SellingPlanCheckoutChargePercentageValue{percentage}}}}}}}';
const definitions=[false,true].flatMap(sale=>[2,3,4,6].map(pieces=>{
 const bps=sale?saleBasisPoints(pieces):Math.round(quantityRate(pieces)*10000);
 const tier=pieces===2?'1–2 modules':pieces===4?'4–5 modules':pieces===6?'6+ modules':'3 modules';
 return {key:'luun-deposit-'+bps,option:tier+', '+(sale?'sale':'regular')+' pricing',percentage:(10000-bps)/500};
}));
type Group={id:string;merchantCode:string;sellingPlans:{nodes:{id:string;options:string[];billingPolicy:{remainingBalanceChargeTrigger?:string;checkoutCharge?:{type:string;value:{percentage?:number}}}}[]}};
export async function GET(){
 const {user,profile}=await getUserContext();
 if(!user||!canSyncShopifyOrders(profile?.role))return NextResponse.json({error:'Not authorized'},{status:403});
 return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luun preorder setup</title><body style="font:18px system-ui;max-width:640px;margin:64px auto;padding:24px;color:#19392a"><h1>Connect preorder payment terms</h1><p>Create reusable payment terms for the current builder modules. This does not activate website checkout or collect a payment.</p><form method="post"><input type="hidden" name="intent" value="initialize"><button style="font:inherit;padding:16px 24px" type="submit">Connect payment terms</button></form></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"}});
}
export async function POST(request:NextRequest){
 const {user,profile}=await getUserContext();
 if(!user||!canSyncShopifyOrders(profile?.role))return NextResponse.json({error:'Not authorized'},{status:403});
 try{
  const config=preorderAppConfig();
  if(request.nextUrl.origin!==config.origin||request.headers.get('origin')!==config.origin)return NextResponse.json({error:'Invalid origin'},{status:403});
  if((await request.formData()).get('intent')!=='initialize')throw new Error('Invalid setup action');
  const result=await preorderAdminGraphQL<{sellingPlanGroups:{pageInfo:{hasNextPage:boolean};nodes:Group[]}}>('query{sellingPlanGroups(first:100){pageInfo{hasNextPage} nodes{'+fields+'}}}');
  if(result.sellingPlanGroups.pageInfo.hasNextPage)throw new Error('Payment terms require review before setup');
  const matches=result.sellingPlanGroups.nodes.filter(group=>group.merchantCode===merchantCode);
  if(matches.length>1)throw new Error('Duplicate payment terms require review');
  let group=matches[0];
  const db=createAdminClient();
  if(!group){
   const claim=await db.from('preorder_app_connections').update({plan_setup_state:'creating'}).eq('shop_domain',config.shop).eq('client_id',config.clientId).is('plan_setup_state',null).select('client_id');
   if(claim.error||claim.data?.length!==1)throw new Error('Payment setup is already in progress; retry after it completes');
   const input={name:'Luun preorder — 20% now, balance when ready',merchantCode,options:['Preorder payment'],sellingPlansToCreate:definitions.map(term=>({name:'20% deposit — '+term.option+'; balance when your complete sofa is ready',category:'PRE_ORDER',options:[term.option],billingPolicy:{fixed:{checkoutCharge:{type:'PERCENTAGE',value:{percentage:term.percentage}},remainingBalanceChargeTrigger:'ON_FULFILLMENT'}},deliveryPolicy:{fixed:{fulfillmentTrigger:'UNKNOWN'}},inventoryPolicy:{reserve:'ON_FULFILLMENT'}}))};
   const resources={productVariantIds:[...new Set(Object.values(FABRICS).flatMap(variants=>Object.values(variants)).map(id=>'gid://shopify/ProductVariant/'+id))]};
   const created=await preorderAdminGraphQL<{sellingPlanGroupCreate:{sellingPlanGroup:Group|null;userErrors:{message:string}[]}}>('mutation($input:SellingPlanGroupInput!,$resources:SellingPlanGroupResourceInput){sellingPlanGroupCreate(input:$input,resources:$resources){sellingPlanGroup{'+fields+'} userErrors{message}}}',{input,resources});
   if(created.sellingPlanGroupCreate.userErrors.length||!created.sellingPlanGroupCreate.sellingPlanGroup){if(created.sellingPlanGroupCreate.userErrors.length&&!created.sellingPlanGroupCreate.sellingPlanGroup)await db.from('preorder_app_connections').update({plan_setup_state:null}).eq('shop_domain',config.shop).eq('client_id',config.clientId).eq('plan_setup_state','creating');throw new Error('Shopify rejected payment terms: '+(created.sellingPlanGroupCreate.userErrors.map(error=>error.message).join('; ')||'No terms returned'));}
   group=created.sellingPlanGroupCreate.sellingPlanGroup;
  }
  const ids:Record<string,string>={};
  for(const definition of definitions){
   const matches=group.sellingPlans.nodes.filter(plan=>plan.options.length===1&&plan.options[0]===definition.option);
   const plan=matches[0];
   if(matches.length!==1||!/^gid:\/\/shopify\/SellingPlan\/[0-9]+$/.test(plan.id)||plan.billingPolicy.remainingBalanceChargeTrigger!=='ON_FULFILLMENT'||plan.billingPolicy.checkoutCharge?.type!=='PERCENTAGE'||Math.abs((plan.billingPolicy.checkoutCharge.value.percentage??-1)-definition.percentage)>1e-8)throw new Error('Shopify payment terms differ from the expected pricing tiers');
   ids[definition.key]=plan.id;
  }
  if(new Set(Object.values(ids)).size!==8)throw new Error('Duplicate payment terms');
  const saved=await db.from('preorder_app_connections').update({plan_group_id:group.id,plan_ids:ids,plan_setup_state:'ready'}).eq('shop_domain',config.shop).eq('client_id',config.clientId);
  if(saved.error)throw new Error('Unable to save payment terms');
  return NextResponse.json({ready:true,terms:8,websiteActivated:false},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Payment setup unavailable'},{status:409});}
}
