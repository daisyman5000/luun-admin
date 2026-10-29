const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

function load(file,imports){
 const exports={};
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(source,{exports,require:(name)=>{
  if(Object.hasOwn(imports,name))return imports[name];
  if(name.startsWith('node:'))return require(name);
  throw new Error(`Unexpected dependency ${name}`);
 },process:{env:{}},Date,Map,Set,JSON,Math});
 return exports;
}

test('managed sale sync permits order coupons without changing exact rates or schedule',async()=>{
 const pricing=load('lib/sales/pricing.ts',{});
 const writes=[];
 const ids=[1,3,4,6].map(n=>`gid://shopify/DiscountAutomaticNode/${n}`);
 const client={shopifyAdminGraphQL:async(query,variables)=>{
  const index=ids.indexOf(variables.id);
  if(query.startsWith('query'))return {automaticDiscountNode:{automaticDiscount:{title:`Luun managed extra 35% sale · ${[1,3,4,6][index]}+ modules`}}};
  writes.push(JSON.parse(JSON.stringify(variables)));
  return {discountAutomaticBasicUpdate:{automaticDiscountNode:{id:variables.id},userErrors:[]}};
 }};
 const sale=load('lib/sales/shopify.ts',{'server-only':{},'@/lib/shopify/client':client,'./pricing':pricing});
 const state={shopify_discount_id:JSON.stringify(ids),starts_at:'2026-10-29T18:17:00.000Z',ends_at:'2026-11-14T17:45:00.000Z'};
 await sale.setShopifySale(state,true);
 assert.equal(writes.length,4);
 assert.deepEqual(writes.map(w=>w.input.customerGets.value.percentage),[.35,.4215,.441,.4475]);
 for(const [index,{id,input}] of writes.entries()){
  assert.equal(id,ids[index]);
  assert.equal(input.startsAt,state.starts_at);
  assert.equal(input.endsAt,state.ends_at);
  assert.deepEqual(input.combinesWith,{productDiscounts:false,orderDiscounts:true,shippingDiscounts:false});
  assert.equal(input.minimumRequirement.quantity.greaterThanOrEqualToQuantity,String([1,3,4,6][index]));
  assert.equal(input.customerGets.items.products.productVariantsToAdd.length,15);
 }
});
