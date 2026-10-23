'use client';

import {ContentScriptImprovements} from './content-script-improvements';
import {useState} from 'react';
import {sourceScriptName} from '../lib/content-video-script-name';
import type {CreatorState} from '../lib/content-video-creator';
import type {SourceBank} from '../lib/content-video-source-bank';

type Readiness={authorized:boolean;message:string;remainingMicrousd:number;approvedMicrousd:number;perRequestMicrousd:number};
type Props={
 project:Pick<CreatorState,'id'|'sourceBank'|'scriptLab'|'sourceQuestion'|'scriptImprovements'>;
 projects:{id:string;script:string;sourceBank?:SourceBank}[];
 busy:boolean;
 error:string;
 readiness:Readiness|null;
 onGenerate:()=>void;
 onChoose:(id:string)=>void;
 improvementStatus?:{authorized:boolean;message:string;remainingMicrousd:number}|null;
 improvementProgress?:string;
 onImprove?:(ids:string[])=>void;
 onPauseImprovement?:()=>void;
};

export function ContentSourceScripts({project,projects,busy,error,readiness,onGenerate,onChoose,improvementStatus,improvementProgress,onImprove,onPauseImprovement}:Props){
 const [selection,setSelection]=useState({id:'',latest:''});
 const bank=project.sourceBank;
 if(!bank)return null;
 const scripts=(project.scriptLab?.candidates||[]).filter(c=>c.sourceBankDigest===bank.digest);
 const latest=scripts.at(-1),selectedId=selection.latest===latest?.id?selection.id:latest?.id;
 const selected=scripts.find(c=>c.id===selectedId)||latest;
 const field='rounded-lg border border-line bg-white p-3 text-sm';
 return <main className="mx-auto max-w-4xl px-5 py-8 sm:p-10">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <h1 className="text-3xl font-semibold">Scripts</h1>
   <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm text-white disabled:opacity-40" disabled={busy||!readiness?.authorized} onClick={onGenerate}>{busy?'Generating…':'Generate'}</button>
  </header>
  <label className="mt-5 block text-sm">Collection
   <select aria-label="Saved projects" className={field+' mt-2 block w-full'} value={project.id} disabled={busy} onChange={e=>onChoose(e.target.value)}>
    {projects.map(p=><option key={p.id} value={p.id}>{p.sourceBank?'Eight source notes':p.script.slice(0,50)||'Untitled video'}</option>)}
   </select>
  </label>
  <p className="mt-3 text-sm text-slate-600">Next: {bank.angles[bank.nextAngle]?.name}</p>
  <p role="status" className="mt-2 text-xs text-slate-500">{readiness?<>US${(readiness.remainingMicrousd/1000000).toFixed(2)} allowance remaining · up to US${(readiness.perRequestMicrousd/1000000).toFixed(2)} reserved per generation. {!readiness.authorized&&readiness.message}</>:'Checking allowance…'}</p>
  {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {project.sourceQuestion&&<p role="status" className="mt-5 rounded-xl border border-line p-5">{project.sourceQuestion.question}</p>}
  {scripts.length>0&&<label className="mt-6 block text-sm">Saved scripts
   <select aria-label="Saved scripts" className={field+' mt-2 block w-full'} disabled={busy} value={selected?.id||''} onChange={e=>setSelection({id:e.target.value,latest:latest?.id||''})}>
    {scripts.map(c=><option key={c.id} value={c.id}>{sourceScriptName(c,bank,scripts)}</option>)}
   </select>
  </label>}
  {selected?<article className="mt-5 rounded-xl border border-line bg-white p-6">
   <h2 className="text-lg font-semibold">{sourceScriptName(selected,bank,scripts)}</h2>
   {selected.coreIdea&&<p className="mt-4 font-medium">{selected.coreIdea}</p>}
   <p className="mt-4 whitespace-pre-wrap text-base leading-7">{selected.script}</p>
  </article>:<p className="mt-6 text-sm text-slate-600">Generate a script from your saved notes.</p>}
  {onImprove&&<ContentScriptImprovements bank={bank} state={project.scriptImprovements} busy={busy} progress={improvementProgress||''} status={improvementStatus||null} onRun={onImprove} onPause={onPauseImprovement||(()=>{})}/> }
  <details className="mt-6 text-sm text-slate-500">
   <summary>Source notes · {bank.notes.length} notes · {bank.angles.length} angles</summary>
   {bank.notes.map(n=><details key={n.id} className="mt-3"><summary>{n.id} — {n.name}</summary><p className="mt-2 whitespace-pre-wrap">{n.text}</p></details>)}
  </details>
 </main>;
}
