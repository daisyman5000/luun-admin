/* eslint-disable @typescript-eslint/no-require-imports -- This harness intercepts CommonJS loading to mock Next route dependencies. */
/* Synthetic route ports only; never load environment files or call a provider. */
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path');
const out='/tmp/luun-instagram-diagnostic-tests',repo=path.resolve(__dirname,'..');
const {NextRequest}=require(path.join(repo,'node_modules/next/server'));
const diagnostics=require(path.join(out,'lib/instagram/oauth-diagnostics.js')),core=require(path.join(out,'lib/instagram/core.js'));
let owner=true,configError=false,storageError=false,exchangeError=null,exchangeStage='short_token',exchanges=0;
const server={instagramHeaders:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'},instagramOwner:async()=>{if(!owner)throw Error('instagram_owner_required');return 'synthetic-owner';},configuredInstagramMetadata:()=>({configured:true,publishingEnabled:false,messagesSendingEnabled:false}),instagramServer:()=>{
 if(configError)throw Error('SYNTHETIC_PRIVATE_ERROR');
 return {config:{appId:'7001',accountId:'9001',redirectUri:core.INSTAGRAM_CALLBACK},connection:async()=>null,connectionMetadata:async()=>({account_id:core.INSTAGRAM_APPROVED_ACCOUNT_ID,username:'luun_official',expires_at:new Date(Date.now()+86400000).toISOString(),scopes:[...core.INSTAGRAM_SCOPES]}),operations:{status:async()=>({available:false,enabled:{publishing:false,receive:false,send:false}})},db:{from:()=>({insert:async()=>({error:null})})},rpc:async()=>true,api:{exchange:async(_code,onStage)=>{exchanges++;onStage(exchangeStage);if(exchangeError)throw exchangeError;return {token:'SYNTHETIC_TOKEN'};}},storeConnection:async()=>{if(storageError)throw Error('instagram_storage_unavailable');}};
}};
const original=Module._load;
Module._load=function(name,...args){if(name==='@/lib/instagram/server')return server;if(name==='@/lib/instagram/core')return core;if(name==='@/lib/instagram/oauth-diagnostics')return diagnostics;if(name==='@/lib/content-access')return {validOperatorOrigin:()=>true};if(name==='next/server')return require(path.join(repo,'node_modules/next/server'));return original.call(this,name,...args);};
const callback=require(path.join(out,'app/api/instagram/callback/route.js')),status=require(path.join(out,'app/api/instagram/status/route.js')),connect=require(path.join(out,'app/api/instagram/connect/route.js'));
Module._load=original;
const state='a'.repeat(64),base='https://luun-admin-et42.vercel.app';
function callbackRequest(){return new NextRequest(base+'/api/instagram/callback?'+new URLSearchParams({state,code:'SYNTHETIC_CODE'}),{headers:{cookie:'luun_instagram_state='+state}});}
function reset(){owner=true;configError=false;storageError=false;exchangeError=null;exchangeStage='short_token';exchanges=0;}
test('unauthenticated callback and status never disclose diagnostics or exchange a token',async()=>{reset();owner=false;const failure={stage:'profile',reason:'account_mismatch'},request=new NextRequest(base+'/api/instagram/status',{headers:{cookie:diagnostics.OAUTH_DIAGNOSTIC_COOKIE+'='+encodeURIComponent(JSON.stringify(failure))}});const r=await status.GET(request);assert.equal(r.status,403);assert.equal((await r.text()).includes('account_mismatch'),false);const cb=await callback.GET(callbackRequest());assert.equal(cb.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE),undefined);assert.equal(exchanges,0);});
test('verified owner sees only fixed failure codes through a secure HttpOnly cookie',async()=>{reset();exchangeStage='profile';exchangeError=Error('instagram_account_mismatch');const r=await callback.GET(callbackRequest()),cookie=r.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE);assert.deepEqual(JSON.parse(cookie.value),{stage:'profile',reason:'account_mismatch'});assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.maxAge,600);assert.equal(r.headers.get('location'),base+'/content?instagram=failed');assert.ok(!JSON.stringify([...r.headers]).includes('SYNTHETIC_CODE'));const visible=await status.GET(new NextRequest(base+'/api/instagram/status',{headers:{cookie:diagnostics.OAUTH_DIAGNOSTIC_COOKIE+'='+encodeURIComponent(cookie.value)}}));assert.deepEqual((await visible.json()).callbackFailure,{stage:'profile',reason:'account_mismatch'});});
test('configuration and persistence errors retain stage but discard raw error text',async()=>{for(const phase of ['configuration','connection_storage']){reset();configError=phase==='configuration';storageError=phase==='connection_storage';const r=await callback.GET(callbackRequest()),failure=JSON.parse(r.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE).value);assert.equal(failure.stage,phase);assert.equal(failure.reason,phase==='configuration'?'unexpected_failure':'storage_unavailable');assert.ok(!JSON.stringify([...r.headers]).includes('SYNTHETIC_PRIVATE_ERROR'));}});
test('successful connection and a fresh connect both clear stale diagnostic cookies',async()=>{reset();const r=await callback.GET(callbackRequest());assert.equal(r.headers.get('location'),base+'/content?instagram=connected');assert.equal(r.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE).maxAge,0);const fresh=await connect.POST(new NextRequest(base+'/api/instagram/connect',{method:'POST'}));assert.equal(fresh.status,200);assert.equal(fresh.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE).maxAge,0);});

test('profile-specific diagnostics remain owner-only and contain no provider values',async()=>{
 for(const reason of ['configured_account_mismatch','professional_id_missing','professional_id_invalid','professional_account_mismatch','profile_username_missing']){
  reset();exchangeStage='profile';exchangeError=Error('instagram_'+reason);
  const response=await callback.GET(callbackRequest());const cookie=response.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE);
  assert.deepEqual(JSON.parse(cookie.value),{stage:'profile',reason});
  const request=new NextRequest(base+'/api/instagram/status',{headers:{cookie:diagnostics.OAUTH_DIAGNOSTIC_COOKIE+'='+encodeURIComponent(cookie.value)}});
  assert.deepEqual((await (await status.GET(request)).json()).callbackFailure,{stage:'profile',reason});
  owner=false;const unsigned=await status.GET(request);assert.equal(unsigned.status,403);assert.ok(!(await unsigned.text()).includes(reason));
  const denied=await callback.GET(callbackRequest());assert.equal(denied.cookies.get(diagnostics.OAUTH_DIAGNOSTIC_COOKIE),undefined);
 }
});

test('a missing controls migration preserves connected account metadata while actions remain off',async()=>{
 reset();const r=await status.GET(new NextRequest(base+'/api/instagram/status'));assert.equal(r.status,200);const body=await r.json();assert.equal(body.connected,true);assert.equal(body.username,'luun_official');assert.equal(body.operations.available,false);assert.equal(body.publishingEnabled,false);assert.equal(body.messagesSendingEnabled,false);assert.equal(body.token_ciphertext,undefined);
});
