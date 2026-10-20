/* eslint-disable @typescript-eslint/no-require-imports -- Render actual TSX with synthetic hooks/fetch, without browser or network access. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const operating=require('/tmp/luun-instagram-diagnostic-tests/lib/instagram/operating-controls.js');
function harness(){const filename=path.resolve('components/instagram-operating-controls.tsx'),source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));const original=m.require.bind(m),state=[];m.require=name=>name==='react'?{useState:initial=>[initial,value=>state.push(value)]}:name==='@/lib/instagram/operating-controls'?operating:original(name);m._compile(source,filename);return {Component:m.exports.InstagramOperatingControls,state};}
const now=Date.now(),account='17841472352520052',settings={account_id:account,version:4,publishing:false,receive:false,send:false,worker_seen_at:new Date(now).toISOString(),webhook_verified_at:new Date(now).toISOString()},connection={account_id:account,expires_at:new Date(now+86400000).toISOString(),scopes:['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_messages']},env={INSTAGRAM_PUBLISHING_ENABLED:'1',INSTAGRAM_WEBHOOK_ENABLED:'1',INSTAGRAM_OUTBOUND_MESSAGES_ENABLED:'1',CRON_SECRET:'SYNTHETIC_CRON_SECRET',INSTAGRAM_WEBHOOK_VERIFY_TOKEN:'SYNTHETIC_VERIFY_TOKEN',INSTAGRAM_WEBHOOK_APP_SECRET:'SYNTHETIC_SIGNING_SECRET'};
function nodes(tree){return !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];}
function text(tree){return tree==null?'':typeof tree==='object'?Array.isArray(tree)?tree.map(text).join(''):text(tree.props?.children):String(tree);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('actual control UI renders three independent accessible off switches and truthful readiness',()=>{
 const {Component}=harness(),operations=operating.operatingStatus(settings,connection,account,{},now),tree=Component({operations,local:false,onChange:()=>{}}),switches=nodes(tree).filter(n=>n.props?.role==='switch');
 assert.equal(switches.length,3);for(const n of switches){assert.equal(n.props['aria-checked'],false);assert.equal(n.props.disabled,true);assert.equal(text(n),'Off');}
 assert.ok(text(tree).includes('deployment configuration'));assert.ok(text(tree).includes('Meta account subscription is not verified here.'));assert.ok(text(tree).includes('No automatic replies.'));
});
test('blocked requested switch can be turned off without prerequisites; ready switch persists exact version',async()=>{
 const realFetch=global.fetch;try{
  const {Component}=harness(),changes=[],requests=[];const operations=operating.operatingStatus({...settings,publishing:true},connection,account,{},now);
  global.fetch=async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return {ok:true,json:async()=>({operations:{...operations,requested:{...operations.requested,publishing:false}}})};};
  const tree=Component({operations,local:false,onChange:s=>changes.push(s)}),toggle=nodes(tree).find(n=>n.props?.role==='switch'&&n.props['aria-label']==='Publishing');assert.equal(toggle.props.disabled,false);assert.equal(text(toggle),'Blocked');toggle.props.onClick();await flush();
  assert.deepEqual(requests,[{url:'/api/instagram/controls',body:{capability:'publishing',enabled:false,version:4}}]);assert.equal(changes[0].requested.publishing,false);
  const ready=operating.operatingStatus(settings,connection,account,env,now),t=Component({operations:ready,local:false,onChange:()=>{}});const send=nodes(t).find(n=>n.props?.role==='switch'&&n.props['aria-label']==='Send approved replies');assert.equal(send.props.disabled,false);send.props.onClick();await flush();assert.deepEqual(requests[1].body,{capability:'send',enabled:true,version:4});
 }finally{global.fetch=realFetch;}
});
test('failed save never claims the switch changed; local preview cannot toggle',async()=>{
 const realFetch=global.fetch;try{const {Component,state}=harness(),changes=[],operations=operating.operatingStatus(settings,connection,account,env,now);global.fetch=async()=>({ok:false,json:async()=>({error:'Control changed in another tab.'})});const tree=Component({operations,local:false,onChange:s=>changes.push(s)});nodes(tree).find(n=>n.props?.role==='switch').props.onClick();await flush();assert.equal(changes.length,0);assert.ok(state.includes('Control changed in another tab.'));for(const n of nodes(Component({operations,local:true,onChange:()=>{}})).filter(n=>n.props?.role==='switch'))assert.equal(n.props.disabled,true);
 }finally{global.fetch=realFetch;}
});

test('compact calendar Settings exposes only Publishing and no readiness diagnostics',()=>{const {Component}=harness(),operations=operating.operatingStatus(settings,connection,account,env,now),tree=Component({operations,local:false,compact:true,onChange:()=>{}}),switches=nodes(tree).filter(n=>n.props?.role==='switch');assert.equal(switches.length,1);assert.equal(switches[0].props['aria-label'],'Publishing');assert.equal(switches[0].props['aria-checked'],false);for(const phrase of ['Receive messages','Send approved replies','Scheduler','Webhook','subscription','saved approval'])assert.ok(!text(tree).includes(phrase));});
