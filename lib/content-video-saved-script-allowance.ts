import {createHash} from 'node:crypto';
import {creatorCostQuote} from './content-video-creator-cost';
import {SUPPORTED_SCRIPT_MODEL,scriptSettings,type ScriptInput} from './content-video-script';
export const SAVED_SCRIPT_PROJECT='80c2d1cf-865d-4ac9-b736-4a6652de9553';
export const SAVED_SCRIPT_JOB='saved-transcript-script-oct22-once';
const owner='913c334c-7c7c-4aed-9ffa-7c8d225a95b0',source='acd140d1ecb382d104ca42e9659d046d6e6e1ed786c8c6c600e4fb449ba14b80',transcript='3d6e03d07e7ea1fcfb97cc7b95945a3f26de3ec9a7a59298adea1d1fe60ecba0';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
// Owner explicitly approved sending this transcript + unchanged owner prompt to
// OpenAI once at 23:37 UTC, USD0.10 additional. Existing USD0.12 audio reservation
// is retained; cumulative project ledger ceiling USD0.22. No other paid purpose.
export function savedScriptAllowance(actor:string,projectId:string,text:string,audioHash:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
 if(actor!==owner||projectId!==SAVED_SCRIPT_PROJECT||audioHash!==source||hash(text)!==transcript||now<Date.parse('2026-10-22T23:37:00Z')||now>=Date.parse('2026-10-23T00:00:00Z'))throw Error('The one-time saved-transcript script authorization is unavailable or expired');
 if(env.LUUN_VIDEO_PAID_ENABLED!==undefined&&env.LUUN_VIDEO_PAID_ENABLED!=='true')throw Error('An explicit operator setting disables paid operations');
 if(env.LUUN_VIDEO_APPROVED_OPERATIONS!==undefined&&!env.LUUN_VIDEO_APPROVED_OPERATIONS.split(',').includes('script'))throw Error('An explicit operator setting excludes text scripts');
 if(env.LUUN_VIDEO_TEST_PROJECT_ID&&env.LUUN_VIDEO_TEST_PROJECT_ID!==projectId)throw Error('The configured project conflicts with this authorization');
 if(env.LUUN_VIDEO_SCRIPT_MODEL&&env.LUUN_VIDEO_SCRIPT_MODEL!==SUPPORTED_SCRIPT_MODEL)throw Error('The configured model conflicts with the approved script model');
 const budget=env.LUUN_VIDEO_PROVIDER_BUDGET_USD===undefined?.22:Number(env.LUUN_VIDEO_PROVIDER_BUDGET_USD);if(!Number.isFinite(budget)||budget<=0)throw Error('An explicit operator budget disables this authorization');
 const quote=creatorCostQuote('script',projectId,{...env,LUUN_VIDEO_TEST_PROJECT_ID:projectId,LUUN_VIDEO_SCRIPT_MODEL:SUPPORTED_SCRIPT_MODEL,LUUN_VIDEO_PROVIDER_BUDGET_USD:String(Math.min(.22,budget))},now);if(quote.reservedMicrousd>100000)throw Error('Script reservation exceeds the additional ten-cent authorization');
 return {actor,projectId,text,audioHash,model:SUPPORTED_SCRIPT_MODEL,quote};
}
export type SavedScriptAllowance=ReturnType<typeof savedScriptAllowance>;
export function assertSavedScriptInput(a:SavedScriptAllowance,input:ScriptInput,env:NodeJS.ProcessEnv=process.env){savedScriptAllowance(a.actor,a.projectId,a.text,a.audioHash,env);if(input.audio?.hash!==source||hash(input.audio?.transcript||'')!==transcript||input.targetSeconds!==30||input.idea||input.feedback||input.previousScript||input.scriptOnly||input.frameworkLocks&&Object.keys(input.frameworkLocks).length||JSON.stringify(input.settings)!==JSON.stringify(scriptSettings(undefined,30)))throw Error('Script request differs from the one approved saved-transcript input');}
