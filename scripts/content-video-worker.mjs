// Local Node worker only. Invoked by native Content API, never through an iframe.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.stdin.setEncoding('utf8');let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>36*1024*1024)throw Error('Local video request exceeds size bound');}
try{
 const root=process.env.LUUN_STORYBOARD_ENGINE_ROOT;
 if(!root||!path.isAbsolute(root)||!fs.existsSync(path.join(root,'lib/video-rough-cut.mjs'))||!fs.existsSync(path.join(root,'data/library.json')))throw Error('Configure the existing local video engine and owned media library.');
 const core=await import(pathToFileURL(path.join(root,'lib/video-creator.mjs')).href),rough=await import(pathToFileURL(path.join(root,'lib/video-rough-cut.mjs')).href);const b=JSON.parse(input||'{}');let result;
 if(b.action==='list')result={projects:core.list().filter(p=>p.mode==='rough-cut'&&(b.includeHidden===true||(!p.demoLabel&&!p.hiddenFromList&&p.id!=='3fa17f94-e84d-459f-af85-a691ad04dac4'))),capabilities:{localOnly:true,providerCalls:false,hostedPersistence:false}};
 else if(b.action==='create')result=rough.createRough();
 else if(b.action==='frame'){const jpeg=await core.frame(b.sourceId,Number(b.offset||0));result={jpeg:jpeg.toString('base64')};}
 else if(b.action==='preview'){const p=core.load(b.id),shot=p.shots.find(s=>s.preview===b.preview);if(!shot)throw Error('Preview is not part of this storyboard');result={jpeg:fs.readFileSync(core.localFile(shot.preview)).toString('base64')};}
 else if(b.action==='download'){const p=core.load(b.id);if(p.mode!=='rough-cut'||!p.output||!fs.existsSync(core.localFile(p.output))||core.bufferHash(fs.readFileSync(core.localFile(p.output)))!==p.outputHash)throw Error('Local render is unavailable or changed');result={file:p.output,hash:p.outputHash};}
 else if(b.action==='context'){const p=core.load(b.id);if(p.mode!=='rough-cut')throw Error('Not a local video project');const samples=await core.sourceSamples({mode:p.sourceMode,selectedIds:p.sourceIds,query:p.script||p.idea||''});result={project:p,candidates:samples.map(({jpeg,...s})=>({...s,preview:core.saveBlob(jpeg,'jpg').file})),coverage:samples.coverage};}
 else result=await core.withProject(b.id,undefined,async p=>{
  if(p.mode!=='rough-cut'||p.providerMode!=='local-assistant')throw Error('Only local assistant rough cuts are supported');
  const replay=(b.action==='handoff'&&p.handoffs?.[b.key])||(b.action==='render'&&p.requests?.[b.key]);if(p.revision!==b.revision&&!replay)throw Error('Video changed in another tab. Reload before continuing.');
  if(b.action==='duration')return core.change(p,'duration',{revision:p.revision,seconds:b.seconds});
  if(b.action==='idea')return rough.idea(p,b.idea);
  if(b.action==='feedback')return rough.requestRevision(p,b);
  if(b.action==='handoff')return rough.handoff(p,b);
  if(b.action==='approve-script'){if(p.stage==='awaiting-script')throw Error('Wait for the assistant draft before approving');return core.change(p,'approve-script',{revision:p.revision});}
  if(b.action==='approve-board'){await core.preflight(p);return rough.approveRoughBoard(p);}
  if(b.action==='render')return rough.renderRough(p,b.key);
  if(b.action==='silent')return rough.silent(p);
  if(b.action==='voice'){p.idea='';p.finalNarration=null;await core.importVoice(p,Buffer.from(b.audio,'base64'),b.type);p.stage='awaiting-script';p.ideaNoteStatus='Idea note stored locally; not automatically transcribed.';return rough.ideaVoiceSaved(p);}
  if(b.action==='narration')return rough.finalNarration(p,Buffer.from(b.audio,'base64'),b.type,b.confirmed===true);
  throw Error('Unsupported local video action');
 });
 process.stdout.write(JSON.stringify({ok:true,result}));
}catch(error){process.stdout.write(JSON.stringify({ok:false,error:error instanceof Error?error.message:'Local video action failed'}));process.exitCode=1;}
