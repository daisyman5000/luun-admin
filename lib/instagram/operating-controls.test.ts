import test from 'node:test';import assert from 'node:assert/strict';
import {operatingStatus,operatingChange,type InstagramOperatingSettings} from './operating-controls';
import {instagramOperations} from './operations';
import {INSTAGRAM_APPROVED_ACCOUNT_ID,INSTAGRAM_SCOPES} from './core';
const now=Date.now(),account=INSTAGRAM_APPROVED_ACCOUNT_ID;
const row:InstagramOperatingSettings={account_id:account,version:0,publishing:false,receive:false,send:false,worker_seen_at:new Date(now).toISOString(),webhook_verified_at:new Date(now).toISOString()};
const connection={account_id:account,expires_at:new Date(now+86400000).toISOString(),scopes:[...INSTAGRAM_SCOPES]};
const env={INSTAGRAM_PUBLISHING_ENABLED:'1',INSTAGRAM_WEBHOOK_ENABLED:'1',INSTAGRAM_OUTBOUND_MESSAGES_ENABLED:'1',CRON_SECRET:'SYNTHETIC_SCHEDULER',INSTAGRAM_WEBHOOK_VERIFY_TOKEN:'SYNTHETIC_VERIFY_TOKEN',INSTAGRAM_WEBHOOK_APP_SECRET:'SYNTHETIC_SIGNING_SECRET'};
test('all Admin controls start off even when deployment and dependencies are ready',()=>{const s=operatingStatus(row,connection,account,env,now);assert.equal(s.available,true);assert.deepEqual(s.enabled,{publishing:false,receive:false,send:false});assert.ok(Object.values(s.readiness).every(r=>r.ready));assert.equal(s.subscriptionStatus,'not_verified');});
test('requested controls require both deployment permission and readiness; missing schema fails closed',()=>{
 const on={...row,publishing:true,receive:true,send:true};assert.deepEqual(operatingStatus(on,connection,account,{},now).enabled,{publishing:false,receive:false,send:false});
 for(const settings of [null,{...on,account_id:'1784147235520052'},{...on,version:-1}])assert.deepEqual(operatingStatus(settings,connection,account,env,now).enabled,{publishing:false,receive:false,send:false});
});
test('expired or foreign account and missing permissions block actions',()=>{
 const on={...row,publishing:true,receive:true,send:true};
 for(const c of [null,{...connection,account_id:'wrong'},{...connection,expires_at:new Date(now-1).toISOString()},{...connection,scopes:[]}])assert.deepEqual(operatingStatus(on,c,account,env,now).enabled,{publishing:false,receive:false,send:false});
});
test('publishing requires recent authenticated worker; verified challenge is independent from unknown subscription',()=>{
 for(const worker_seen_at of [null,new Date(now-5*60000).toISOString(),new Date(now+1000).toISOString()])assert.equal(operatingStatus({...row,publishing:true,worker_seen_at},connection,account,env,now).enabled.publishing,false);
 const s=operatingStatus({...row,receive:true,webhook_verified_at:null},connection,account,env,now);assert.equal(s.enabled.receive,false);assert.equal(s.subscriptionStatus,'not_verified');
 assert.equal(operatingStatus({...row,receive:false,send:true},connection,account,env,now).enabled.send,true);
});
test('control payloads accept only exact capability, boolean and optimistic version',()=>{
 assert.deepEqual(operatingChange({capability:'send',enabled:false,version:2}),{capability:'send',enabled:false,version:2});
 for(const b of [null,[],{capability:'send',enabled:'1',version:0},{capability:'send',enabled:true,version:-1},{capability:'all',enabled:true,version:0},{capability:'send',enabled:true,version:0,actor:'spoof'},{capability:'send',enabled:true,version:0,account_id:account}])assert.throws(()=>operatingChange(b));
});
function fixture(settings:InstagramOperatingSettings|null=row,environment:Record<string,string|undefined>=env){let data=settings,error=false;const calls:unknown[]=[];const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data,error:error?{}:null})})})}),rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});if(error)return {error:{}};if(name==='set_instagram_operating_control')data={...data!,version:data!.version+1,[String(args.p_capability)]:args.p_enabled};return {error:null};}} as unknown as Parameters<typeof instagramOperations>[0];return {ops:instagramOperations(db,account,async()=>connection,()=>environment),calls,fail:()=>{error=true;}};}
test('unready, missing-schema and stale requests never invoke the write RPC',async()=>{
 for(const f of [fixture(null),fixture(row,{}),fixture()]){const version=f.calls.length===0?1:0;await assert.rejects(f.ops.change('owner','publishing',true,version));assert.equal(f.calls.length,0);}
 const f=fixture(row,{});await assert.rejects(f.ops.change('owner','send',true,0));assert.equal(f.calls.length,0);
});
test('off is always available for an existing setting even when dependencies fail',async()=>{
 const f=fixture({...row,send:true},{});const s=await f.ops.change('trusted-actor','send',false,0);assert.equal(s.requested.send,false);assert.deepEqual(f.calls,[{name:'set_instagram_operating_control',args:{p_actor:'trusted-actor',p_account:account,p_capability:'send',p_enabled:false,p_version:0}}]);
});
test('storage errors and unavailable status cannot authorize an operation',async()=>{const f=fixture({...row,send:true});await f.ops.requireEnabled('send');f.fail();await assert.rejects(f.ops.requireEnabled('send'));await assert.rejects(f.ops.change('actor','send',false,0));});
test('readiness and saved settings never disclose secrets or connection ciphertext',()=>{const s=operatingStatus({...row,send:true},connection,account,env,now);for(const secret of Object.values(env).filter(v=>v.startsWith('SYNTHETIC')))assert.ok(!JSON.stringify(s).includes(secret));assert.ok(!JSON.stringify(s).includes('token_ciphertext'));});
