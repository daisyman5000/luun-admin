import {creatorCostQuote} from './content-video-creator-cost';
import {SUPPORTED_SCRIPT_MODEL} from './content-video-script';
// Owner approved one text-only test, USD0.50 TOTAL, October22. Not recurring access.
// This replaces absent prototype setup scaffolding; explicit operator restrictions win.
export const SCRIPT_TEST_PROJECT='ab788bd2-47b8-47a5-a1f6-86cf4c299cf4';
const owner='913c334c-7c7c-4aed-9ffa-7c8d225a95b0';
export function scriptTestAllowance(actor:string,projectId:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
 if(actor!==owner||projectId!==SCRIPT_TEST_PROJECT||now<Date.parse('2026-10-22T18:43:15Z')||now>=Date.parse('2026-10-23T00:00:00Z'))throw Error('The one-time script test authorization is unavailable or expired');
 if(env.LUUN_VIDEO_PAID_ENABLED!==undefined&&env.LUUN_VIDEO_PAID_ENABLED!=='true')throw Error('An explicit operator setting disables paid operations; the script test cannot override it');
 if(env.LUUN_VIDEO_APPROVED_OPERATIONS!==undefined&&!env.LUUN_VIDEO_APPROVED_OPERATIONS.split(',').includes('script'))throw Error('An explicit operator setting excludes script generation');
 if(env.LUUN_VIDEO_SCRIPT_MODEL&&env.LUUN_VIDEO_SCRIPT_MODEL!==SUPPORTED_SCRIPT_MODEL)throw Error('The configured script model conflicts with the approved supported model');
 if(env.LUUN_VIDEO_TEST_PROJECT_ID&&env.LUUN_VIDEO_TEST_PROJECT_ID!==projectId)throw Error('The configured test project conflicts with this authorization');
 const budget=env.LUUN_VIDEO_PROVIDER_BUDGET_USD===undefined?.5:Number(env.LUUN_VIDEO_PROVIDER_BUDGET_USD);if(!Number.isFinite(budget)||budget<=0)throw Error('An explicit operator budget disables this test');
 const quote=creatorCostQuote('script',projectId,{...env,LUUN_VIDEO_SCRIPT_MODEL:SUPPORTED_SCRIPT_MODEL,LUUN_VIDEO_TEST_PROJECT_ID:projectId,LUUN_VIDEO_PROVIDER_BUDGET_USD:String(Math.min(.5,budget))},now);
 return {actor,projectId,expiresAt:'2026-10-23T00:00:00Z',model:SUPPORTED_SCRIPT_MODEL,quote};
}
export type ScriptTestAllowance=ReturnType<typeof scriptTestAllowance>;
