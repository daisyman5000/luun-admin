import type {ScriptCandidate} from './content-video-script';
import type {SourceBank} from './content-video-source-bank';
export function sourceScriptName(candidate:Pick<ScriptCandidate,'id'|'scriptName'|'angleId'|'angleName'|'sourceNoteIds'>,bank:SourceBank,history:ScriptCandidate[]){
 if(candidate.scriptName)return candidate.scriptName;
 const angle=bank.angles.find(a=>a.id===candidate.angleId||a.name===candidate.angleName);
 const position=history.findIndex(c=>c.id===candidate.id),through=position<0?[...history,candidate]:history.slice(0,position+1);
 const version=through.filter(c=>angle?c.angleId===angle.id||c.angleName===angle.name:c.angleName===candidate.angleName).length;
 const notes=(candidate.sourceNoteIds||angle?.noteIds||[]).map(id=>'N'+id).join('+')||'N??';
 const angleNumber=angle?.id.replace(/^angle-/,'').padStart(2,'0')||'??';
 return `${notes}-A${angleNumber}-V${String(version||1).padStart(3,'0')} — ${candidate.angleName||angle?.name||'Saved script'}`;
}
