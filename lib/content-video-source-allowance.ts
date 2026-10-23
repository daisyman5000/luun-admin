import {createHash} from 'node:crypto';
import {creatorCostQuote,creatorScriptReservationMicrousd} from './content-video-creator-cost';
import {SUPPORTED_SCRIPT_MODEL,type ScriptInput} from './content-video-script';
import {sourceScriptInput} from './content-video-source-bank';
import type {SourceBank} from './content-video-source-bank';
import type {CreatorState} from './content-video-creator';

// Owner authorized USD1 TOTAL, at most USD0.10 per manual attempt, on 2026-10-23.
// Includes live verification; no recurring grant, automatic retries or other stages.
export const SOURCE_SCRIPT_SCOPE='eight-source-notes-2026-10-23';
export const SOURCE_SCRIPT_PROJECT='0bfa399c-4349-4e94-abab-c3963cac5544';
export const SOURCE_SCRIPT_OWNER='913c334c-7c7c-4aed-9ffa-7c8d225a95b0';
const digest='3eb438e76815e2df071aab76f3060c3d61a97ce6bac143a6624341f99110b337';
const fingerprint='0514781ceb0bd1fef78bc4b702051b7d0f2d7db8996874c8c12b28e4422845e8';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// JSONB can reorder object keys. Bind values and array order, not key insertion order.
export const sourceBankFingerprint=(bank:SourceBank)=>hash({notes:bank.notes.map(n=>[n.id,n.name,n.text]),angles:bank.angles.map(a=>[a.id,a.name,a.noteIds,a.focus])});
export function sourceScriptLedger(p:CreatorState){
 const jobs=Object.values(p.jobs||{}),usedMicrousd=jobs.reduce((n,j)=>n+(j.cost?.reservedMicrousd||0),0),perRequestMicrousd=creatorScriptReservationMicrousd(),approvedMicrousd=1000000;
 return {approvedMicrousd,usedMicrousd,remainingMicrousd:Math.max(0,approvedMicrousd-usedMicrousd),perRequestMicrousd,requestSlots:Math.max(0,10-jobs.reduce((n,j)=>n+j.requests,0))};
}
export function sourceScriptStatus(actor:string,p:CreatorState){
 const jobs=Object.values(p.jobs||{}),ledger=sourceScriptLedger(p),{remainingMicrousd,perRequestMicrousd,requestSlots}=ledger,bank=p.sourceBank;
 let message='';
 if(actor!==SOURCE_SCRIPT_OWNER||p.id!==SOURCE_SCRIPT_PROJECT||!bank||bank.digest!==digest||sourceBankFingerprint(bank)!==fingerprint)message='This allowance covers only the saved eight-note collection and its owner project';
 else if(p.sourceQuestion)message='A concrete detail is needed before writing. Answer the saved question before generating again';
 else if(!Number.isInteger(bank.nextAngle)||bank.nextAngle<0||bank.nextAngle>=bank.angles.length)message='The saved angle position is invalid';
 else if(jobs.some(j=>!j.cost||j.cost.allowanceScope!==SOURCE_SCRIPT_SCOPE||j.cost.projectId!==p.id))message='Prior project reservations need reconciliation';
 else if(remainingMicrousd<perRequestMicrousd||!requestSlots)message='The US$1 total source-script allowance is exhausted';
 else if(jobs.some(j=>j.status==='pending'||j.status==='uncertain'))message='Resolve the pending or uncertain request before generating again';
 else if(Buffer.byteLength(JSON.stringify(p))>180000||(p.scriptLab?.candidates.length||0)>=20)message='Saved history reached its storage bound; previous versions are preserved';
 return {authorized:!message,message:message||'Ready for manual text generation; no recurring spending',...ledger};
}
export function sourceScriptAllowance(actor:string,p:CreatorState,env:NodeJS.ProcessEnv=process.env){
 const status=sourceScriptStatus(actor,p);if(!status.authorized)throw Error(status.message);
 if(env.LUUN_VIDEO_PAID_ENABLED!==undefined&&env.LUUN_VIDEO_PAID_ENABLED!=='true')throw Error('An explicit operator setting disables paid calls');
 if(env.LUUN_VIDEO_APPROVED_OPERATIONS!==undefined&&!env.LUUN_VIDEO_APPROVED_OPERATIONS.split(',').includes('script'))throw Error('An explicit operator setting excludes scripts');
 if(env.LUUN_VIDEO_TEST_PROJECT_ID&&env.LUUN_VIDEO_TEST_PROJECT_ID!==p.id)throw Error('An explicit operator project restriction blocks this request');
 if(env.LUUN_VIDEO_SCRIPT_MODEL&&env.LUUN_VIDEO_SCRIPT_MODEL!==SUPPORTED_SCRIPT_MODEL)throw Error('The configured script model conflicts with the supported model');
 const configured=env.LUUN_VIDEO_PROVIDER_BUDGET_USD===undefined?1:Number(env.LUUN_VIDEO_PROVIDER_BUDGET_USD);
 if(!Number.isFinite(configured)||configured<=0)throw Error('An explicit operator budget disables scripts');
 const quote={...creatorCostQuote('script',p.id,{...env,LUUN_VIDEO_TEST_PROJECT_ID:p.id,LUUN_VIDEO_SCRIPT_MODEL:SUPPORTED_SCRIPT_MODEL,LUUN_VIDEO_PROVIDER_BUDGET_USD:String(Math.min(1,configured))}),allowanceScope:SOURCE_SCRIPT_SCOPE};
 if(quote.reservedMicrousd>100000||status.usedMicrousd+quote.reservedMicrousd>quote.budgetMicrousd)throw Error('The source-script spending limit is reached');
 return {actor,project:p,model:SUPPORTED_SCRIPT_MODEL,quote};
}
export type SourceScriptAllowance=ReturnType<typeof sourceScriptAllowance>;
export function assertSourceScriptInput(a:SourceScriptAllowance,input:ScriptInput){
 if(!a.project.sourceBank||hash(input)!==hash(sourceScriptInput(a.project.sourceBank).input))throw Error('This allowance permits only the saved source-angle text request');
}
