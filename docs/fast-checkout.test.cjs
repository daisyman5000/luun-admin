const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,modules,globals={}){const ctx={exports:{},require:n=>modules[n]||require(n),process:{env:{SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_STOREFRONT_ACCESS_TOKEN:'test'}},...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const pricing=load('lib/sales/pricing.ts',{});
function setup({preorder=true,active=true,cartChange,confirmation}={}){
 const calls=[],counts={corner:2,armless:1,ottoman:0},total=pricing.quote(counts,active).totalCents;
 const bps=active?4215:1100,plan='gid://shopify/SellingPlan/1';
 const subtotal=counts.corner*pricing.MODULE_CENTS.corner+counts.armless*pricing.MODULE_CENTS.armless;
 const due=preorder?Object.keys(counts).reduce((n,k)=>n+counts[k]*Math.round(pricing.MODULE_CENTS[k]*(10000-bps)/50000),0):total;
 const cart={id:'gid://shopify/Cart/test?key=secret',checkoutUrl:'https://example.myshopify.com/checkout',discountAllocations:[{discountedAmount:{amount:String((subtotal-total)/100),currencyCode:'CAD'}}],cost:{subtotalAmount:{amount:String(subtotal/100),currencyCode:'CAD'},checkoutChargeAmount:{amount:String(due/100),currencyCode:'CAD'}},lines:{nodes:['corner','armless'].map((k,i)=>({quantity:counts[k],merchandise:{id:`gid://shopify/ProductVariant/${i+1}`},sellingPlanAllocation:preorder?{sellingPlan:{id:plan},checkoutChargeAmount:{amount:String(Math.round(pricing.MODULE_CENTS[k]*(10000-bps)/50000)/100),currencyCode:'CAD'}}:null}))}};
 if(cartChange)cartChange(cart);
 const modules={
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>{throw Error('Checkout must not make separate database reads');},rpc:async(name,args)=>{calls.push({name,args});return confirmation||{data:{eta:preorder?'2026-10-20':null}};}})},
  '@/lib/sales/shopify':{FABRICS:{'dark-grey':{corner:1,armless:2,ottoman:3}}},
  '@/lib/sales/pricing':pricing,
  './connection':{preorderAppConfig:()=>({shop:'example.myshopify.com',clientId:'test'})}
 };
 const api=load('lib/preorders/fast-checkout.ts',modules,{fetch:async(url,options)=>{calls.push({name:'cartCreate',options});return {ok:true,json:async()=>({data:{cartCreate:{cart,userErrors:[]}}})};}});
 return {api,calls,total,due,body:{counts,fabric:'dark-grey',preorder,expectedTotalCents:total,planId:preorder?plan:null}};
}
for(const active of [false,true])for(const preorder of [false,true])test(`${active?'sale':'regular'} ${preorder?'20%':'full-pay'} uses one Shopify call and one atomic database confirmation`,async()=>{
 const x=setup({active,preorder}),result=await x.api.fastCheckout(x.body,'127.0.0.1');
 assert.equal(result.cart.totalCents,x.total);assert.equal(result.cart.depositCents,x.due);
 assert.equal(x.calls.length,2);assert.equal(x.calls[1].name,'confirm_luun_checkout');assert.equal(x.calls[1].args.preorder_input,preorder);
 const input=JSON.parse(x.calls[0].options.body).variables.input;
 assert.equal(x.calls[0].options.headers['Shopify-Storefront-Buyer-IP'],'127.0.0.1');
 assert.equal(input.lines.every(l=>preorder?!!l.sellingPlanId:!l.sellingPlanId),true);
});
test('stale sale, changed availability, or exhausted inventory never returns a checkout URL',async()=>{
 for(const error of ['Pricing changed.','Availability changed.','Configuration exceeds remaining inventory']){const x=setup({confirmation:{data:{error}}});await assert.rejects(x.api.fastCheckout(x.body,'127.0.0.1'),new RegExp(error.replaceAll('.','\\.')));}
});
test('wrong deposit charge and changed cart quantities fail before stock is reserved',async()=>{
 for(const cartChange of [cart=>cart.cost.checkoutChargeAmount.amount='1',cart=>cart.lines.nodes[0].quantity=9]){const x=setup({cartChange});await assert.rejects(x.api.fastCheckout(x.body,'127.0.0.1'));assert.equal(x.calls.length,1);}
});
test('invalid price is rejected before creating a Shopify cart',async()=>{const x=setup();x.body.expectedTotalCents=1;await assert.rejects(x.api.fastCheckout(x.body,'127.0.0.1'));assert.equal(x.calls.length,0);});
