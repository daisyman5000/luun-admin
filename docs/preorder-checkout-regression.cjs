const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/api/preorder-checkout/route.ts'),'utf8');
const callbacks=[],calls=[];
function query(table){
 calls.push(table);const q={};for(const m of ['select','eq','is','lt','limit'])q[m]=()=>q;
 q.single=q.maybeSingle=async()=>({data:table==='preorder_app_connections'?{plan_setup_state:'ready',plan_ids:{'luun-deposit-4215':'gid://shopify/SellingPlan/1'}}:{eta:'2026-10-20'}});
 q.then=(resolve,reject)=>Promise.resolve({data:table==='inventory'?[{fabric_slug:'dark-grey',module_slug:'corner',available_qty:7,reserved_qty:0},{fabric_slug:'dark-grey',module_slug:'armless',available_qty:0,reserved_qty:0}]:table==='container_entries'?[{id:'7',container_number:'MT-LUUN-007',status:'planning',eta:'2099-10-20',manifest_json:[{color:'dark-grey',module:'armless',quantity:10}]}]:[]}).then(resolve,reject);return q;
}
const modules={
 'next/server':{after:fn=>callbacks.push(fn),NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
 '@/lib/supabase/admin':{createAdminClient:()=>({from:query,rpc:async(name)=>{calls.push(name);return {data:true}}})},
 '@/lib/sales/public-headers':{allowedStorefront:()=>true,headersFor:()=>new Headers()},
 '@/lib/sales/shopify':{FABRICS:{'dark-grey':{corner:1,armless:2,ottoman:3}}},
 '@/lib/sales/pricing':{validateCounts:x=>x,quote:()=>({totalCents:234072}),quantityRate:()=>.11,saleBasisPoints:()=>4215,MODULE_CENTS:{corner:148462,armless:107692,ottoman:61538}},
 '@/lib/preorders/connection':{preorderAppConfig:()=>({shop:'example.myshopify.com',clientId:'test'})},
 '@/lib/sales/store':{readSale:async()=>({version:1})},
 '@/lib/sales/types':{isSaleActive:()=>true},
 '@/lib/preorders/cancel-prepared':{cancelPreparedCart:async()=>true}
};
const context={exports:{},require:name=>modules[name]||require(name),process:{env:{LUUN_DOWNPAY_ENABLED:'1',SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_STOREFRONT_ACCESS_TOKEN:'test'}},Response,console,Intl,Date,fetch:async()=>{calls.push('cartCreate');return {ok:true,json:async()=>({data:{cartCreate:{cart:{id:'test-cart',checkoutUrl:'https://example.myshopify.com/checkout',discountAllocations:[],cost:{subtotalAmount:{amount:'2340.72',currencyCode:'CAD'},checkoutChargeAmount:{amount:'468.14',currencyCode:'CAD'}},lines:{nodes:[{quantity:2,merchandise:{id:'gid://shopify/ProductVariant/1'},sellingPlanAllocation:{sellingPlan:{id:'gid://shopify/SellingPlan/1'},checkoutChargeAmount:{amount:'171.77',currencyCode:'CAD'}}},{quantity:1,merchandise:{id:'gid://shopify/ProductVariant/2'},sellingPlanAllocation:{sellingPlan:{id:'gid://shopify/SellingPlan/1'},checkoutChargeAmount:{amount:'124.6',currencyCode:'CAD'}}}]}},userErrors:[]}}})}}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
(async()=>{
 const get=await context.exports.GET(new Request('https://test/api'));
 assert.equal(get.status,200);assert.equal(callbacks.length,1);assert(!calls.includes('preorder_reservations'),'GET must return before querying abandoned carts');
 calls.length=0;
 const post=await context.exports.POST(new Request('https://test/api',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1'},body:JSON.stringify({counts:{corner:2,armless:1,ottoman:0},fabric:'dark-grey',preorder:true})}));
 assert.equal(post.status,200,JSON.stringify(post.body));assert.equal(post.body.depositCents,46814);assert.equal(post.body.totalCents,234072);
 assert(calls.includes('claim_preorder_inventory'));assert.equal(calls.filter(x=>x==='cartCreate').length,1);
 assert(!calls.includes('preorder_reservations')||calls.filter(x=>x==='preorder_reservations').length===1,'POST must only read its newly claimed reservation');
 const prepared=await context.exports.POST(new Request('https://test/api',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1'},body:JSON.stringify({counts:{corner:2,armless:1,ottoman:0},fabric:'dark-grey',prepare:true,expectedTotalCents:234072})}));assert.equal(prepared.status,200);assert.equal(prepared.body.cartId,'test-cart');assert.equal(prepared.body.depositCents,46814);
 const changed=await context.exports.POST(new Request('https://test/api',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1'},body:JSON.stringify({counts:{corner:2,armless:1,ottoman:0},fabric:'dark-grey',prepare:true,expectedTotalCents:1})}));assert.equal(changed.status,409);
 console.log('PASS: inventory response does not wait for maintenance; checkout creates one native cart, validates deposit, and reserves inventory.');
})().catch(e=>{console.error(e);process.exitCode=1});
