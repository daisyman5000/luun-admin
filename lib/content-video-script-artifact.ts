import {createHash} from 'node:crypto';
import {safeScriptText,validateIdeaOptions} from './content-video-script';
import {validateCreatorScript} from './content-video-creator';
export type ScriptArtifact={kind:'openai-script-artifact-v1';model:string;status:string;outputs:string[];refusals:string[];error?:string;retentionError?:string;sourceDigest:string};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function redact(value:unknown,depth=0):unknown{if(depth>12)throw Error('Provider JSON nesting exceeds the safe retention bound');if(typeof value==='string')return safeScriptText(value);if(Array.isArray(value))return value.map(v=>redact(v,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[safeScriptText(k),redact(v,depth+1)]));return value;}
function retainText(text:string){try{return JSON.stringify(redact(JSON.parse(text)));}catch{return safeScriptText(text);}}
// Called before artifact validation. Keep the complete sanitized bounded output,
// including malformed JSON or overlong scripts, so paid results remain reviewable.
export function captureScriptArtifact(response:unknown,model:string):ScriptArtifact{
 const r=object(response),content=(Array.isArray(r.output)?r.output:[]).filter(x=>object(x).type==='message').flatMap(x=>Array.isArray(object(x).content)?object(x).content as unknown[]:[]).map(object),outputs=content.filter(x=>x.type==='output_text'&&typeof x.text==='string').map(x=>String(x.text)),refusals=content.filter(x=>x.type==='refusal').map(x=>String(x.refusal||'OpenAI declined this request'));
 const sourceDigest=createHash('sha256').update(JSON.stringify({outputs,refusals,error:r.error})).digest('hex');
 const a:ScriptArtifact={kind:'openai-script-artifact-v1',model,status:safeScriptText(String(r.status||'missing')).slice(0,100),outputs:[],refusals:[],sourceDigest};
 if(Buffer.byteLength(JSON.stringify({outputs,refusals,error:r.error}))>48000){a.retentionError='Provider output exceeded the 48,000-byte retention bound; content was not truncated into a draft. Only its digest was retained.';return a;}
 a.outputs=outputs.map(retainText);a.refusals=refusals.map(safeScriptText);if(r.error)a.error=safeScriptText(JSON.stringify(redact(r.error)));
 if(Buffer.byteLength(JSON.stringify(a))>60000){a.outputs=[];a.refusals=[];a.error=undefined;a.retentionError='Sanitized provider output exceeded the durable package bound; no partial draft was substituted. Only its digest was retained.';}
 return a;
}
export function isScriptArtifact(v:unknown):v is ScriptArtifact{return object(v).kind==='openai-script-artifact-v1';}
export function validateScriptArtifact(a:ScriptArtifact,seconds:number,scriptOnly=false){
 if(a.retentionError)throw Error(a.retentionError);
 const saved='The sanitized provider output is saved for review; no automatic retry was made.';
 if(a.status!=='completed'||a.error)throw Error(`OpenAI did not return a completed script (${a.status}). ${saved}`);
 if(a.refusals.length)throw Error(`OpenAI declined this script request. ${saved}`);
 if(a.outputs.length!==1)throw Error(`OpenAI did not return one structured script (${a.outputs.length} outputs). ${saved}`);
 let value:unknown;try{value=JSON.parse(a.outputs[0]);}catch{throw Error(`OpenAI returned an invalid script artifact: malformed JSON. ${saved}`);}
 const raw=object(value),limit=Math.ceil(seconds*2.8);
 if(typeof raw.script!=='string'||!raw.script.trim())throw Error(`Script response is incomplete: finished dialogue is missing. ${saved}`);
 const words=raw.script.trim().split(/\s+/).length;
 if(seconds===60&&(words<130||words>160))throw Error(`The 60-second script has ${words} words; expected 130–160. ${saved}`);
 if(raw.script.length>5000||words>limit)throw Error(`Script response is too long: ${words} words / ${raw.script.length} characters; the ${seconds}-second target permits at most ${limit} words and 5000 characters. ${saved}`);
 if(!Array.isArray(raw.claimsToVerify)||raw.claimsToVerify.length>20||raw.claimsToVerify.some(c=>typeof c!=='string'||c.length>300))throw Error(`Script response is incomplete: claimsToVerify must contain at most 20 strings, each at most 300 characters. ${saved}`);
 try{return {...validateCreatorScript(raw,seconds),...validateIdeaOptions(raw,scriptOnly)};}catch(e){throw Error(`${e instanceof Error?e.message:'Script contract is invalid'}. ${saved}`);}
}
