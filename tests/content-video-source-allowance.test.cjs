/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'source-allowance-'));
execFileSync(process.execPath,[root+'/node_modules/typescript/bin/tsc','lib/content-video-creator-providers.ts','--strict','--module','commonjs','--target','es2020','--esModuleInterop','--skipLibCheck','--outDir',out],{cwd:root});
const a=require(out+'/content-video-source-allowance'),{creatorProviders}=require(out+'/content-video-creator-providers'),{creatorJob}=require(out+'/content-video-creator');
const project=()=>({id:a.SOURCE_SCRIPT_PROJECT,revision:0,targetSeconds:60,script:'',stage:'idea'});
test('source grant refuses missing, different and digest-spoofed notes and foreign actors/projects',()=>{
 const p=project();for(const value of [p,{...p,id:'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'},{...p,sourceBank:{digest:'3eb438e76815e2df071aab76f3060c3d61a97ce6bac143a6624341f99110b337',notes:[],angles:[],nextAngle:0}}])assert.throws(()=>a.sourceScriptAllowance(a.SOURCE_SCRIPT_OWNER,value,{}),/only the saved eight-note/);
 assert.equal(a.sourceScriptStatus('other-owner',p).authorized,false);
});
test('one-dollar ledger retains failed and uncertain reservations and never resets with time',()=>{
 const p=project();p.jobs=Object.fromEntries(Array.from({length:10},(_,i)=>['attempt-'+i,{requests:1,status:['complete','failed','uncertain'][i%3],cost:{reservedMicrousd:100000,allowanceScope:a.SOURCE_SCRIPT_SCOPE,projectId:p.id}}]));
 const ledger=a.sourceScriptLedger(p);assert.equal(ledger.usedMicrousd,1000000);assert.equal(ledger.remainingMicrousd,0);assert.equal(ledger.requestSlots,0);assert.equal(ledger.perRequestMicrousd,100000);
 assert.deepEqual(a.sourceScriptLedger(structuredClone(p)),ledger);
});
test('atomic reservations allow ten text jobs total, cached replay costs nothing, eleventh cannot dispatch',async()=>{
 let p=project(),calls=0;const store={load:async()=>structuredClone(p),save:async(id,revision,next)=>{assert.equal(id,p.id);if(revision!==p.revision)throw Error('stale');p={...structuredClone(next),revision:revision+1};return structuredClone(p);}},quote={projectId:p.id,budgetMicrousd:1000000,reservedMicrousd:100000,allowanceScope:a.SOURCE_SCRIPT_SCOPE};
 const run=async reserve=>{reserve();calls++;return {stage:'script'};};
 for(let i=0;i<10;i++)await creatorJob(store,structuredClone(p),'source-attempt-'+i,'script',{i},run,10,quote);
 await creatorJob(store,structuredClone(p),'source-attempt-9','script',{i:9},run,10,quote);assert.equal(calls,10);
 await assert.rejects(()=>creatorJob(store,structuredClone(p),'source-attempt-10','script',{i:10},run,10,quote),/request limit|allowance/);assert.equal(calls,10);assert.equal(a.sourceScriptLedger(p).remainingMicrousd,0);
});
test('source-only provider rejects transcription, editing, separate ideas and changed source before network',async()=>{
 let calls=0;const p=project(),api=creatorProviders({OPENAI_API_KEY:'fixture'},async()=>{calls++;throw Error('unexpected network');},false,undefined,undefined,undefined,undefined,{actor:a.SOURCE_SCRIPT_OWNER,project:p,model:'fixture',quote:{}});
 assert.throws(()=>api.assert('idea'),/text scripts only/);assert.throws(()=>api.assert('generate'),/text scripts only/);await assert.rejects(()=>api.ideas('x'),/excludes separate idea/);await assert.rejects(()=>api.scriptArtifact({idea:'other',targetSeconds:60}),/only the saved eight-note/);assert.equal(calls,0);
});
