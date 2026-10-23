/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'source-script-ui-'));
execFileSync(process.execPath,[root+'/node_modules/typescript/bin/tsc','components/content-source-scripts.tsx','--jsx','react-jsx','--strict','--module','commonjs','--target','es2020','--esModuleInterop','--skipLibCheck','--outDir',out],{cwd:root});
fs.symlinkSync(path.join(root,'node_modules'),path.join(out,'node_modules'),'dir');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ContentSourceScripts}=require(out+'/components/content-source-scripts'),{sourceScriptName}=require(out+'/lib/content-video-script-name');
const bank={digest:'saved-corpus',nextAngle:1,notes:[{id:'01',name:'Original note',text:'Preserved source text'},{id:'08',name:'Other note',text:'Other source'}],angles:[{id:'angle-1',name:'Fundamentals before decoration',noteIds:['01']},{id:'angle-2',name:'Another angle',noteIds:['01','08']}]};
const first={id:'first',sourceBankDigest:bank.digest,angleName:bank.angles[0].name,sourceNoteIds:['01'],coreIdea:'Others add products. We improve ours.',script:'Actual saved script.'},second={...first,id:'second'},other={...first,id:'other',angleName:bank.angles[1].name,sourceNoteIds:['01','08']};
test('names identify source, angle and per-angle version, including legacy saved candidates',()=>{
 const history=[first,other,second],before=JSON.stringify(history);
 assert.equal(sourceScriptName(first,bank,history),'N01-A01-V001 — Fundamentals before decoration');
 assert.equal(sourceScriptName(second,bank,history),'N01-A01-V002 — Fundamentals before decoration');
 assert.equal(sourceScriptName(other,bank,history),'N01+N08-A02-V001 — Another angle');
 assert.equal(JSON.stringify(history),before);
 assert.equal(sourceScriptName({...first,scriptName:'Persisted exact name'},bank,history),'Persisted exact name');
});
test('source view renders named saved dialogue and Generate without the manual/video form',()=>{
 const html=renderToStaticMarkup(React.createElement(ContentSourceScripts,{project:{id:'project',sourceBank:bank,scriptLab:{candidates:[first]}},projects:[{id:'project',script:'',sourceBank:bank}],busy:false,error:'',readiness:{authorized:true,remainingMicrousd:900000,approvedMicrousd:1000000,perRequestMicrousd:100000},onGenerate(){},onChoose(){}}));
 assert.match(html,/N01-A01-V001/);assert.match(html,/Others add products\. We improve ours\./);assert.match(html,/Actual saved script\./);assert.match(html,/>Generate<\/button>/);assert.match(html,/US\$0.90/);
 assert.doesNotMatch(html,/Draft duration|Draft source|Owner-written|Save unapproved draft|Approve script|Use this draft|<textarea|0 words|Upload audio|Narration/);
});
test('no saved scripts shows a single generation prompt and no empty editor',()=>{
 const html=renderToStaticMarkup(React.createElement(ContentSourceScripts,{project:{id:'project',sourceBank:bank},projects:[{id:'project',script:'',sourceBank:bank}],busy:false,error:'',readiness:null,onGenerate(){},onChoose(){}}));
 assert.match(html,/Generate a script from your saved notes/);assert.match(html,/disabled/);assert.doesNotMatch(html,/<textarea|Approve script|Draft duration/);
});

test('improvement cards preserve originals, expose weak ideas and show bounded budget without deletion controls',()=>{
 const {ContentScriptImprovements}=require(out+'/components/content-script-improvements');
 const state={scope:'test',notes:{'01':{noteId:'01',jobs:{critique:{status:'complete'}},critique:{baseline:{coreIdea:'Core',script:'Original sample'},reason:'Missing proof',buyerBenefit:'',weakLines:[]},comparison:{winner:'none',verdict:'weak',reason:'No supported benefit',missingDetail:'Which material changed comfort?'}}}};
 const html=renderToStaticMarkup(React.createElement(ContentScriptImprovements,{bank,state,busy:false,progress:'',status:{authorized:true},onRun(){},onPause(){}}));
 assert.match(html,/US\$2.00 total/);assert.match(html,/US\$0.25 per note/);assert.match(html,/Weak audio idea/);assert.match(html,/Original sample/);assert.match(html,/Which material changed comfort/);assert.doesNotMatch(html,/>Delete|Approve script|<textarea/);
});
