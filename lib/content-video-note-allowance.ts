import {createHash} from 'node:crypto';
import {creatorCostQuote} from './content-video-creator-cost';
// Owner's contextual authorization on October 22, 22:55 UTC: this saved note once,
// USD0.12 total. No scripts, other recordings, recurring allowance, or replay.
export const NOTE_PROJECT='80c2d1cf-865d-4ac9-b736-4a6652de9553';
const owner='913c334c-7c7c-4aed-9ffa-7c8d225a95b0',audioHash='acd140d1ecb382d104ca42e9659d046d6e6e1ed786c8c6c600e4fb449ba14b80';
const chunks=['33f6fac58b4ddd9cd9d4b21f333adbdb552b7c34f1facdc2704c570be4097763','5201d446a3834a422e92d2951b5f1f43a40248b2db18d2f7b39dace2f5ed502f','09002dc002aa820e5209f38984cbd90a99399486e0a0c4c75d5a3f240a5d5132','be5d93b15f86a320b13b4005559a370396d6a904ca4456f130463729a6ecafb4'];
export function noteAllowance(actor:string,projectId:string,sourceHash:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
 if(actor!==owner||projectId!==NOTE_PROJECT||sourceHash!==audioHash||now<Date.parse('2026-10-22T22:55:00Z')||now>=Date.parse('2026-10-23T00:00:00Z'))throw Error('The one-time saved-note authorization is unavailable or expired');
 if(env.LUUN_VIDEO_PAID_ENABLED!==undefined&&env.LUUN_VIDEO_PAID_ENABLED!=='true')throw Error('An explicit operator setting disables paid operations');
 if(env.LUUN_VIDEO_APPROVED_OPERATIONS!==undefined&&!env.LUUN_VIDEO_APPROVED_OPERATIONS.split(',').includes('idea-transcription'))throw Error('An explicit operator setting excludes idea transcription');
 if(env.LUUN_VIDEO_TEST_PROJECT_ID&&env.LUUN_VIDEO_TEST_PROJECT_ID!==projectId)throw Error('The configured project conflicts with this authorization');
 const configured=env.LUUN_VIDEO_PROVIDER_BUDGET_USD===undefined?.12:Number(env.LUUN_VIDEO_PROVIDER_BUDGET_USD);if(!Number.isFinite(configured)||configured<=0)throw Error('An explicit operator budget disables this authorization');
 const quote=creatorCostQuote('idea',projectId,{...env,LUUN_VIDEO_TEST_PROJECT_ID:projectId,LUUN_VIDEO_PROVIDER_BUDGET_USD:String(Math.min(.12,configured))},now);
 return {actor,projectId,sourceHash,quote,expiresAt:'2026-10-23T00:00:00Z'};
}
export type NoteAllowance=ReturnType<typeof noteAllowance>;
export function assertNoteChunk(allowance:NoteAllowance,bytes:Buffer,env:NodeJS.ProcessEnv=process.env){noteAllowance(allowance.actor,allowance.projectId,allowance.sourceHash,env);if(!chunks.includes(createHash('sha256').update(bytes).digest('hex')))throw Error('Audio bytes differ from the four approved saved-note chunks');}
