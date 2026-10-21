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

function deleteFixture(state='queued',fail=false){let post={...emptyPost,id:'22222222-2222-4222-8222-222222222222',version:4,title:'SYNTHETIC scheduled',objective:'Fixture',caption:'Test only',assetReference:'instagram-media:11111111-1111-4111-8111-111111111111',status:'approved',approvedAt:new Date().toISOString(),plannedAt:new Date(Date.now()+86400000).toISOString()} as import('./content').ContentPost,job=state;const calls:{name:string;args:Record<string,unknown>}[]=[];const db={from(table:string){const b={select(){return b;},eq(){return b;},order(){return b;},limit(){return b;},async single(){return {data:{package:table==='operator_content_posts'?post:{...emptyBusinessPlan,version:3}},error:null};},async returns(){return {data:[{package:post}],error:null};}};return b;},async rpc(name:string,args:Record<string,unknown>){calls.push({name,args});if(fail||['creating','processing','publishing','reconciling','published'].includes(job))return {data:null,error:{message:'synthetic guard race'}};if(args.p_expected_version!==post.version)return {data:null,error:{message:'version conflict'}};post={...post,...args.p_package as object,version:post.version+1};job='cancelled';return {data:post,error:null};}};return{store:createOperatorDatabase(db as unknown as OperatorDatabase),calls,get:()=>({post,job}),begin(){if(job!=='queued'||post.status!=='approved')throw Error('approval changed');job='creating';}};}
test('Delete archives exact version and cancels queued publication in one guarded RPC; repeated request is idempotent and calendar omits record',async()=>{const f=deleteFixture(),id=f.get().post.id;const deleted=await f.store.archivePost(id,4,'owner');assert.ok(deleted.deletedAt);assert.equal(f.get().job,'cancelled');assert.equal(deleted.caption,'Test only');assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'save_operator_content_post');assert.equal((f.calls[0].args.p_package as {status:string}).status,'draft');assert.equal((await f.store.listPosts()).length,0);await f.store.archivePost(id,4,'owner');assert.equal(f.calls.length,1);await assert.rejects(f.store.savePost({...deleted,status:'draft'},'owner'),/deleted/);assert.throws(()=>f.begin(),/approval changed/);});
test('Delete rejects unauthorized, stale, published and publishing-race outcomes without hiding records',async()=>{for(const role of ['viewer','logistics',null]){const f=deleteFixture();await assert.rejects(f.store.archivePost(f.get().post.id,4,role),/Owner\/admin/);assert.equal(f.calls.length,0);}const stale=deleteFixture();await assert.rejects(stale.store.archivePost(stale.get().post.id,3,'owner'),/changed/);assert.equal(stale.calls.length,0);for(const state of ['creating','processing','publishing','reconciling','published']){const f=deleteFixture(state);await assert.rejects(f.store.archivePost(f.get().post.id,4,'owner'),/not confirmed/);assert.equal(f.get().post.deletedAt,undefined);assert.equal((await f.store.listPosts()).length,1);}const f=deleteFixture();f.begin();await assert.rejects(f.store.archivePost(f.get().post.id,4,'owner'),/not confirmed/);assert.equal(f.get().job,'creating');});
test('Delete failure never partially changes the post or queue; exact RPC package remains recoverable',async()=>{const f=deleteFixture('queued',true);await assert.rejects(f.store.archivePost(f.get().post.id,4,'admin'),/not confirmed/);assert.equal(f.get().job,'queued');assert.equal(f.get().post.deletedAt,undefined);assert.equal(f.get().post.version,4);});
