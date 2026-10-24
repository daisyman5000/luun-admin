import {createHash} from 'node:crypto';
import type {CreatorState} from './content-video-creator';
import {sourceScriptName} from './content-video-script-name';
import {bestImprovement,bestAvailableImprovement} from './content-script-improvement-types';

// Resolve saved content on the server; the browser cannot supply replacement text.
export function videoScriptHandoff(p:CreatorState,selection:{candidateId?:unknown;noteId?:unknown;referenceResultId?:unknown},revision:unknown){
 if(p.revision!==revision)throw Error('Scripts changed. Reload before choosing a video script');
 if(!p.sourceBank)throw Error('Choose a saved source-note collection');
 let script='',name='',selectionId='';
 if(typeof selection.referenceResultId==='string'&&!selection.noteId&&!selection.candidateId){const r=p.adReferences?.results.find(r=>r.id===selection.referenceResultId);if(!r||!r.script)throw Error('Saved reference script is unavailable');script=r.script;name=r.name;selectionId='reference:'+r.id;
 }else if(typeof selection.candidateId==='string'&&!selection.noteId&&!selection.referenceResultId){
  const c=p.scriptLab?.candidates.find(c=>c.id===selection.candidateId&&c.sourceBankDigest===p.sourceBank!.digest);
  if(!c)throw Error('Saved script is unavailable');
  script=c.script;name=sourceScriptName(c,p.sourceBank,p.scriptLab!.candidates);selectionId=c.id;
 }else if(typeof selection.noteId==='string'&&!selection.candidateId&&!selection.referenceResultId){
  const source=p.sourceBank.notes.find(n=>n.id===selection.noteId),note=p.scriptImprovements?.notes[String(selection.noteId)];
  const best=note&&(bestImprovement(note)||bestAvailableImprovement(note));
  if(!source||!best)throw Error('Reviewed script is unavailable');
  script=best.script;name=`N${source.id}-R001 — ${source.name}`;selectionId='review:'+source.id;
 }else throw Error('Choose one saved script');
 if(!script.trim()||script.length>5000)throw Error('Saved script is empty or too long');
 const hash=createHash('sha256').update(JSON.stringify([p.id,p.sourceBank.digest,selectionId,script])).digest('hex');
 const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
 return {id,script,videoName:name,scriptOrigin:{projectId:p.id,selectionId,digest:p.sourceBank.digest,scriptHash:createHash('sha256').update(script).digest('hex')}};
}
