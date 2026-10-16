import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperatorDatabase, readOperatorContext, type OperatorDatabase } from './content-database';
import { emptyBusinessPlan } from './business-plan';
import { emptyPost } from './content';
import { requireContentWrite } from './content-permissions';
function fixture(fail=false){
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const db={from(table:string){const builder={select(){return builder;},eq(){return builder;},order(){return builder;},limit(){return builder;},async single(){return {data:fail?null:{package:{...emptyBusinessPlan,version:3}},error:fail?{message:'private database details'}:null};},async returns(){return {data:[],error:fail?{message:'private database details'}:null};}};assert.ok(['operator_business_plan','operator_content_posts'].includes(table));return builder;},async rpc(name:string,args:Record<string,unknown>){calls.push({name,args});return {data:{...(args.p_package as Record<string,unknown>),id:'11111111-1111-4111-8111-111111111111',version:1},error:null};}};
 return {store:createOperatorDatabase(db as unknown as OperatorDatabase),db:db as unknown as OperatorDatabase,calls};
}
test('database repository uses authenticated RPC writes; viewers and local media approval are denied',async()=>{
 const {store,calls}=fixture();
 const body={...emptyPost,title:'TEST ONLY',objective:'Fixture',caption:'Fixture',assetReference:'https://example.invalid/private.png'};
 await assert.rejects(store.savePost(body,'viewer'),/Not authorized/);assert.equal(calls.length,0);
 await assert.rejects(store.savePost({...body,status:'approved'},'logistics'),/Owner\/admin/);
 await assert.rejects(store.savePost({...body,status:'approved',assetReference:'creative-lab:asset-mac'},'owner'),/still on the Mac/);
 await store.savePost(body,'logistics');assert.equal(calls[0].name,'save_operator_content_post');assert.equal(calls[0].args.p_plan_version,3);
 await assert.rejects(store.savePlan({...emptyBusinessPlan},'logistics'),/Owner\/admin/);
 await store.savePlan({...emptyBusinessPlan},'owner');assert.equal(calls[1].name,'save_operator_business_plan');
 assert.throws(()=>requireContentWrite('logistics','draft','approved'),/Owner\/admin/);
});
test('missing database schema fails closed; context reports unavailable and never returns local records',async()=>{
 const {store,db}=fixture(true);await assert.rejects(store.listPosts(),/migration/);await assert.rejects(store.readPlan(),/migration/);
 const context=await readOperatorContext(db);assert.equal(context.available,false);assert.ok(!JSON.stringify(context).includes('private database details'));
});
