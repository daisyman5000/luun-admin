export type ImprovementPhase='critique'|'revise'|'judge';
export type ImprovedScript={coreIdea:string;script:string};
export type ScriptCritique={baseline:ImprovedScript;verdict:'worthwhile'|'needs-detail'|'weak';reason:string;buyerBenefit:string;proof:{quote:string;use:string}[];weakLines:{line:string;problem:string;fix:string}[]};
export type ScriptComparison={winner:'A'|'B'|'C'|'none';verdict:'worthwhile'|'needs-detail'|'weak';reason:string;missingDetail:string;assessments:{label:'A'|'B'|'C';supported:boolean;hook:number;clarity:number;contrast:number;benefit:number;proof:number;action:number;reason:string}[]};
export type ImprovementJob={phase:ImprovementPhase;status:'pending'|'complete'|'failed'|'uncertain';reservedMicrousd:number;startedAt:number;inputHash:string;result?:unknown;error?:string};
export type NoteImprovement={noteId:string;sourceHash:string;original?:ImprovedScript;originalName?:string;critique?:ScriptCritique;revisions?:ImprovedScript[];comparison?:ScriptComparison;blindOrder?:number[];jobs:Partial<Record<ImprovementPhase,ImprovementJob>>};
export type ScriptImprovements={scope:string;notes:Record<string,NoteImprovement>};
export const IMPROVEMENT_SCOPE='eight-note-improvement-2026-10-23-v1';
export const IMPROVEMENT_TOTAL=2000000;
export const IMPROVEMENT_PER_NOTE=250000;
export const IMPROVEMENT_PER_CALL=80000;
export const IMPROVEMENT_PHASES:ImprovementPhase[]=['critique','revise','judge'];
export function improvementLedger(state?:ScriptImprovements){const used=Object.values(state?.notes||{}).reduce((sum,n)=>sum+Object.values(n.jobs).reduce((v,j)=>v+(j?.reservedMicrousd||0),0),0);return {approvedMicrousd:IMPROVEMENT_TOTAL,usedMicrousd:used,remainingMicrousd:Math.max(0,IMPROVEMENT_TOTAL-used)};}
export function improvementPending(state?:ScriptImprovements){return Object.values(state?.notes||{}).some(n=>Object.values(n.jobs).some(j=>j?.status==='pending'||j?.status==='uncertain'));}
export function effectiveComparison(c:ScriptComparison|undefined):ScriptComparison|undefined{return c&&c.missingDetail.trim()?{...c,winner:'none',verdict:c.verdict==='weak'?'weak':'needs-detail'}:c;}
export function bestImprovement(note:NoteImprovement){const c=effectiveComparison(note.comparison);if(!c||c.winner==='none'||c.verdict!=='worthwhile'||!note.blindOrder||!note.critique)return null;const index=note.blindOrder[['A','B','C'].indexOf(c.winner)];return [note.critique.baseline,...(note.revisions||[])][index]||null;}
export function nextImprovementPhase(note?:NoteImprovement):ImprovementPhase|null{if(note){const stopped=Object.values(note.jobs).find(j=>j?.status!=='complete');if(stopped)return stopped.status==='failed'&&stopped.result?stopped.phase:null;}return IMPROVEMENT_PHASES.find(phase=>!note?.jobs[phase])||null;}
