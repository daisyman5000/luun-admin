/* eslint-disable @typescript-eslint/no-require-imports -- Intercept server dependencies for an offline persistence boundary test. */
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path');
const out='/tmp/luun-instagram-diagnostic-tests/lib/instagram',core=require(path.join(out,'core.js'));
const config={appId:'1820435792490081',accountId:core.INSTAGRAM_APPROVED_ACCOUNT_ID,appSecret:'SYNTHETIC_SECRET',key:Buffer.alloc(32,7).toString('base64'),apiVersion:'v24.0',redirectUri:core.INSTAGRAM_CALLBACK},writes=[];
const db={from:()=>({upsert:async row=>{writes.push(row);return {error:null};}})};
const original=Module._load;Module._load=function(name,...args){if(name==='server-only')return {};if(name==='../supabase/admin')return {createAdminClient:()=>db};if(name==='../auth')return {};if(name==='../operator-environment')return {inspectOperatorEnvironment:()=>({configured:true})};if(name==='./transport')return {instagramTransport:async()=>{throw Error('Provider access forbidden in test');}};if(name==='./core')return {...core,instagramConfig:()=>config};return original.call(this,name,...args);};
const {instagramServer,jobPorts}=require(path.join(out,'server.js'));Module._load=original;
test('credential persistence independently rejects a foreign professional account before database access',async()=>{writes.length=0;const s=instagramServer();await assert.rejects(s.storeConnection({token:'SYNTHETIC_TOKEN',expiresIn:3600,username:'luun_official',scopes:[...core.INSTAGRAM_SCOPES],accountId:'1784147235520053'}),/account_mismatch/);assert.equal(writes.length,0);});
test('encrypted storage stays pinned to the professional account and excludes the login-scoped identifier',async()=>{writes.length=0;const s=instagramServer();await s.storeConnection({token:'SYNTHETIC_TOKEN',expiresIn:3600,username:'luun_official',scopes:[...core.INSTAGRAM_SCOPES],accountId:config.accountId,scopedId:'1020000000000001'});assert.equal(writes.length,1);assert.equal(writes[0].account_id,config.accountId);assert.equal(writes[0].scopedId,undefined);assert.equal(writes[0].token,undefined);assert.ok(!writes[0].token_ciphertext.includes('SYNTHETIC_TOKEN'));assert.equal(core.openToken(writes[0].token_ciphertext,config),'SYNTHETIC_TOKEN');});

test('credential storage rejects the previously mistyped account ID',async()=>{
 writes.length=0;await assert.rejects(instagramServer().storeConnection({token:'SYNTHETIC_TOKEN',expiresIn:3600,username:'luun_official',scopes:[...core.INSTAGRAM_SCOPES],accountId:'1784147235520052'}),/account_mismatch/);assert.equal(writes.length,0);
});

test('publishing ports recheck the Admin setting immediately before unsafe provider operations',async()=>{
 let enabled=true,calls=0;const api={create:async()=>{calls++;return 'container';},publish:async()=>{calls++;return 'media';},status:async()=> 'FINISHED',permalink:async()=>null};
 const s={api,operations:{requireEnabled:async()=>{if(!enabled)throw Error('instagram_operation_disabled');}}};
 const ports=jobPorts(s).ports;
 assert.equal(await ports.api.create('SYNTHETIC_TOKEN','https://example.invalid/image.jpg','Synthetic'),'container');enabled=false;
 await assert.rejects(ports.api.create('SYNTHETIC_TOKEN','https://example.invalid/image.jpg','Synthetic'),/disabled/);
 await assert.rejects(ports.api.publish('SYNTHETIC_TOKEN','container'),/disabled/);assert.equal(calls,1);
});
