import {SUPPORTED_SCRIPT_MODEL,SCRIPT_MAX_OUTPUT_TOKENS} from './content-video-script';
// Verified first-party standard API rates, 2026-10-21. No implicit model selection.
// https://platform.claude.com/docs/en/models/sonnet-4-6/overview
// https://developers.openai.com/api/docs/models/whisper-1
// https://developers.openai.com/api/docs/models/gpt-5.4-mini
export const CREATOR_PRICE_CHECKED='2026-10-21';
export const CREATOR_LIMITS={scriptInputTokens:32000,editInputTokens:64000,scriptOutputTokens:SCRIPT_MAX_OUTPUT_TOKENS,editOutputTokens:5000,maxAudioSeconds:120,maxImages:12,maxImageSide:640,scriptTextBytes:24000,editTextBytes:22000};
export type CreatorCostReservation={projectId:string;budgetMicrousd:number;reservedMicrousd:number;model:string;priceChecked:string;inputTokenLimit:number;outputTokenLimit:number;audioSecondsLimit:number};
export function creatorCostQuote(stage:'script'|'generate'|'idea',projectId:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()):CreatorCostReservation{
 const age=now-Date.parse(CREATOR_PRICE_CHECKED+'T00:00:00Z');if(age<0||age>7*86400000)throw Error('Video price verification expired; recheck official rates before paid calls');
 const model=stage==='idea'?'whisper-1':stage==='script'?env.LUUN_VIDEO_SCRIPT_MODEL:env.LUUN_VIDEO_CLAUDE_MODEL;if(model!==(stage==='idea'?'whisper-1':stage==='script'?SUPPORTED_SCRIPT_MODEL:'claude-sonnet-4-6'))throw Error('This video adapter has no verified pricing/tool contract for the configured provider/model');
 if(!/^[a-f0-9-]{36}$/.test(projectId)||env.LUUN_VIDEO_TEST_PROJECT_ID!==projectId)throw Error('Paid Video testing is restricted to its explicitly approved project');
 const budget=Number(env.LUUN_VIDEO_PROVIDER_BUDGET_USD);if(!Number.isFinite(budget)||budget<=0||budget>2||Math.round(budget*1000000)!==budget*1000000)throw Error('Set an approved Video provider allowance of at most USD 2');
 const inputTokenLimit=stage==='idea'?0:stage==='script'?CREATOR_LIMITS.scriptInputTokens:CREATOR_LIMITS.editInputTokens,outputTokenLimit=stage==='idea'?0:stage==='script'?CREATOR_LIMITS.scriptOutputTokens:CREATOR_LIMITS.editOutputTokens,audioSecondsLimit=stage==='script'?0:120;
 // Script GPT-5.4 Mini: $.75/MTok input + $4.50/MTok output. Edit Sonnet 4.6: $3/$15; Whisper: $.006/min.
 // Reserve 2x the full bounded request, round UP to a whole cent; never refund.
 const maximum=inputTokenLimit*(stage==='script'?.75:3)+outputTokenLimit*(stage==='script'?4.5:15)+Math.ceil(audioSecondsLimit/60)*6000,reservedMicrousd=Math.ceil(2*maximum/10000)*10000;
 return {projectId,budgetMicrousd:Math.floor(budget*1000000),reservedMicrousd,model:model!,priceChecked:CREATOR_PRICE_CHECKED,inputTokenLimit,outputTokenLimit,audioSecondsLimit};
}
export function reserveCreatorCost(jobs:Record<string,{cost?:CreatorCostReservation}>|undefined,quote:CreatorCostReservation){if(Object.values(jobs||{}).some(j=>!j.cost))throw Error('Prior provider operations lack cost reservations; reconcile them before using this allowance');const used=Object.values(jobs||{}).reduce((n,j)=>n+(j.cost?.reservedMicrousd||0),0);if(!Number.isSafeInteger(quote.reservedMicrousd)||quote.reservedMicrousd<=0||used+quote.reservedMicrousd>quote.budgetMicrousd)throw Error('This project reached its approved provider cost allowance');return quote;}
// Require canonical, bounded PCM rather than trusting client-supplied duration metadata.
export function creatorWavSeconds(bytes:Buffer){if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.toString('ascii',12,16)!=='fmt '||bytes.readUInt32LE(16)!==16||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(22)!==1||bytes.readUInt32LE(24)!==48000||bytes.readUInt32LE(28)!==96000||bytes.readUInt16LE(32)!==2||bytes.readUInt16LE(34)!==16||bytes.toString('ascii',36,40)!=='data'||bytes.readUInt32LE(40)!==bytes.length-44||bytes.readUInt32LE(4)!==bytes.length-8)throw Error('Transcription requires the verified 48 kHz PCM recording');const seconds=(bytes.length-44)/96000;if(seconds<=0||seconds>CREATOR_LIMITS.maxAudioSeconds)throw Error('Recording exceeds the approved audio duration');return seconds;}
