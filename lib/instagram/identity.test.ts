import test from 'node:test';
import assert from 'node:assert/strict';
import {InstagramClient} from './client';
import {INSTAGRAM_APPROVED_ACCOUNT_ID,INSTAGRAM_CALLBACK,INSTAGRAM_SCOPES,instagramConfig,type InstagramConfig} from './core';
const config:InstagramConfig={appId:'1820435792490081',accountId:INSTAGRAM_APPROVED_ACCOUNT_ID,appSecret:'SYNTHETIC_SECRET',key:Buffer.alloc(32,7).toString('base64'),apiVersion:'v24.0',redirectUri:INSTAGRAM_CALLBACK};
const scoped='1020000000000001',short={access_token:'SYNTHETIC_SHORT',user_id:scoped,permissions:[...INSTAGRAM_SCOPES]},profile={id:scoped,user_id:config.accountId,username:'luun_official'},long={access_token:'SYNTHETIC_LONG',expires_in:3600};
function mocked(responses:unknown[],c=config){const seen:{url:URL;init:RequestInit}[]=[];const send=(async(input:URL|RequestInfo,init:RequestInit={})=>{seen.push({url:new URL(String(input)),init});if(!responses.length)throw Error('Unexpected mock request');return Response.json(responses.shift());}) as typeof fetch;return {api:new InstagramClient(c,send),seen};}
test('different scoped/professional IDs bind to the pinned Luun account before long-token exchange',async()=>{
 const f=mocked([short,profile,long,profile]),result=await f.api.exchange('SYNTHETIC_CODE');
 assert.equal(result.scopedId,scoped);assert.equal(result.accountId,INSTAGRAM_APPROVED_ACCOUNT_ID);assert.equal(result.username,'luun_official');
 assert.deepEqual(f.seen.map(x=>x.url.pathname),['/oauth/access_token','/v24.0/me','/access_token','/v24.0/me']);
 for(const i of [1,3])assert.equal(f.seen[i].url.searchParams.get('fields'),'id,user_id,username');
 assert.equal(new Headers(f.seen[1].init.headers).get('authorization'),'Bearer SYNTHETIC_SHORT');
 assert.equal(new Headers(f.seen[3].init.headers).get('authorization'),'Bearer SYNTHETIC_LONG');
});
test('another professional account is rejected even if it supplies the expected username',async()=>{
 const f=mocked([short,{...profile,user_id:'1784147235520053'}]);await assert.rejects(f.api.exchange('SYNTHETIC_CODE'),/account_mismatch/);assert.equal(f.seen.length,2);
});
test('a configured alternate account cannot replace the pinned approved professional account',async()=>{
 assert.throws(()=>instagramConfig({INSTAGRAM_CONNECTION_ENABLED:'1',INSTAGRAM_APP_SECRET:config.appSecret,INSTAGRAM_TOKEN_ENCRYPTION_KEY:config.key,INSTAGRAM_GRAPH_API_VERSION:'v24.0',INSTAGRAM_ACCOUNT_ID:'1784147235520053'}),/setup_required/);
 const f=mocked([short,profile],{...config,accountId:'1784147235520053'});await assert.rejects(f.api.exchange('SYNTHETIC_CODE'),/account_mismatch/);
});
test('contradictory scoped or professional identities cannot survive either profile check',async()=>{
 for(const responses of [[short,{...profile,id:'1020000000000002'}],[short,profile,long,{...profile,id:'1020000000000002'}],[short,profile,long,{...profile,user_id:'1784147235520053'}]])await assert.rejects(mocked(responses).api.exchange('SYNTHETIC_CODE'),/account_mismatch/);
});
test('missing, empty, negative, fractional and malformed identifiers fail closed',async()=>{
 for(const id of [undefined,null,'',0,-1,1.5,' 1020000000000001','00123']){
  await assert.rejects(mocked([{...short,user_id:id}]).api.exchange('SYNTHETIC_CODE'),/identifier_invalid|response_unconfirmed/);
  await assert.rejects(mocked([short,{...profile,id}]).api.exchange('SYNTHETIC_CODE'),/identifier_invalid|response_unconfirmed/);
  await assert.rejects(mocked([short,{...profile,user_id:id}]).api.exchange('SYNTHETIC_CODE'),/professional_id_missing|professional_id_invalid|response_unconfirmed/);
 }
 for(const username of [undefined,''])await assert.rejects(mocked([short,{...profile,username}]).api.exchange('SYNTHETIC_CODE'),/profile_username_missing/);
});
test('safe numeric IDs normalize exactly and large decimal string IDs retain precision',async()=>{
 for(const id of [Number(scoped),'9007199254740993']){const p={...profile,id};const r=await mocked([{...short,user_id:id},p,long,p]).api.exchange('SYNTHETIC_CODE');assert.equal(r.scopedId,String(id));assert.equal(r.accountId,config.accountId);}
 const numeric={...profile,id:Number(scoped),user_id:config.accountId};assert.equal((await mocked([{...short,user_id:Number(scoped)},numeric,long,numeric]).api.exchange('SYNTHETIC_CODE')).accountId,config.accountId);
});
test('single-record envelopes are supported while ambiguous or multi-account payloads are rejected',async()=>{
 assert.equal((await mocked([{data:[short]},{data:[profile]},long,{data:[profile]}]).api.exchange('SYNTHETIC_CODE')).accountId,config.accountId);
 for(const payload of [{data:[profile,profile]},{...profile,data:[profile]},{data:[]},{data:[{data:[profile]}]}])await assert.rejects(mocked([short,payload]).api.exchange('SYNTHETIC_CODE'),/response_unconfirmed/);
});
test('incomplete or extra scope grants still prevent profile lookup and long-token exchange',async()=>{
 for(const permissions of [['instagram_business_basic'],[...INSTAGRAM_SCOPES,'ads_management']]){const f=mocked([{...short,permissions}]);await assert.rejects(f.api.exchange('SYNTHETIC_CODE'),/permissions_incomplete/);assert.equal(f.seen.length,1);}
});
test('publishing and reply routes retain the canonical professional ID, never the scoped login ID',async()=>{
 const f=mocked([short,profile,long,profile,{id:'SYNTHETIC_CONTAINER'},{id:'SYNTHETIC_MEDIA'},{message_id:'SYNTHETIC_MESSAGE',recipient_id:'8001'}]);const c=await f.api.exchange('SYNTHETIC_CODE');
 await f.api.create(c.token,'https://example.invalid/synthetic.jpg','Synthetic');await f.api.publish(c.token,'SYNTHETIC_CONTAINER');await f.api.sendReply(c.token,'8001','Synthetic');
 assert.deepEqual(f.seen.slice(4).map(x=>x.url.pathname),[`/v24.0/${config.accountId}/media`,`/v24.0/${config.accountId}/media_publish`,`/v24.0/${config.accountId}/messages`]);
});

test('corrected owner-confirmed account is accepted while old and foreign pins remain rejected',async()=>{
 const env={INSTAGRAM_CONNECTION_ENABLED:'1',INSTAGRAM_APP_SECRET:config.appSecret,INSTAGRAM_TOKEN_ENCRYPTION_KEY:config.key,INSTAGRAM_GRAPH_API_VERSION:'v24.0'};
 assert.equal(INSTAGRAM_APPROVED_ACCOUNT_ID,'17841472352520052');
 assert.equal(instagramConfig({...env,INSTAGRAM_ACCOUNT_ID:'17841472352520052'}).accountId,'17841472352520052');
 for(const other of ['1784147235520052','17841472352520053']){
  assert.throws(()=>instagramConfig({...env,INSTAGRAM_ACCOUNT_ID:other}),/setup_required/);
  await assert.rejects(mocked([short,{...profile,user_id:other}]).api.exchange('SYNTHETIC_CODE'),/professional_account_mismatch/);
  await assert.rejects(mocked([short,profile],{...config,accountId:other}).api.exchange('SYNTHETIC_CODE'),/configured_account_mismatch/);
 }
});
