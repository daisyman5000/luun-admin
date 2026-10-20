import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {localMediaRequestAllowed} from './local-content';
export type VideoShot={id:string;name:string;source:string;seconds:number;offset:number;preview:string;reason:string;synthetic:boolean|null;rights:{basis?:string;reason?:string};provenance:Record<string,unknown>};
export type VideoProject={id:string;revision:number;mode:'rough-cut';stage:string;targetSeconds:number;idea?:string;ideaNoteStatus?:string;voice?:unknown;script:string;claimsToVerify?:string[];scriptApproval?:string|null;boardApproval?:string|null;shots:VideoShot[];missingAssets:string[];roughCaptions?:{text:string;start:number;end:number}[];finalNarration?:unknown;output?:string|null;error?:string|null;demoLabel?:string};
export function contentVideoAllowed(request:Request){return process.env.LUUN_LOCAL_VIDEO==='1'&&localMediaRequestAllowed(request);}
export function videoDirectory(){return path.join(process.cwd(),'.local-content','video');}
export function videoDownloadPath(name:unknown,directory=videoDirectory()){
 if(typeof name!=='string'||!/^[a-f0-9-]{36}\.mp4$/.test(name))throw Error('Invalid local export');const root=fs.realpathSync(directory),file=fs.realpathSync(path.join(root,name));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('Export escaped local video storage');return file;
}
export function localVideoCall(body:Record<string,unknown>,options?:{engineRoot?:string;directory?:string;worker?:string}):Promise<unknown>{
 const root=options?.engineRoot||process.env.LUUN_STORYBOARD_ENGINE_ROOT;if(!root||!path.isAbsolute(root))return Promise.reject(Error('Local video engine is not configured. Set LUUN_STORYBOARD_ENGINE_ROOT to the existing Creative Lab prototype.'));
 const serialized=JSON.stringify(body);if(Buffer.byteLength(serialized)>36*1024*1024)return Promise.reject(Error('Local video request is too large'));
 return new Promise((resolve,reject)=>{
  // Do not inherit provider keys, hosted database credentials or provider approvals.
  const child=spawn(process.execPath,[options?.worker||path.join(process.cwd(),'scripts/content-video-worker.mjs')],{cwd:root,env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',LUUN_STORYBOARD_ENGINE_ROOT:root,LUUN_DATA_DIR:path.join(root,'data'),LUUN_VIDEO_DIR:options?.directory||videoDirectory(),LUUN_VIDEO_LIVE_ENABLED:'false',LUUN_VIDEO_DRIVE_ENABLED:'false',LUUN_VIDEO_FIXTURE_MODE:'false',LUUN_VIDEO_APPROVED_OPERATIONS:''},stdio:['pipe','pipe','pipe']});let output='',size=0,settled=false;const fail=(message:string)=>{if(!settled){settled=true;child.kill();reject(Error(message));}};const timer=setTimeout(()=>fail('Local video action timed out. Saved approvals remain; reload and retry the local render.'),body.action==='render'?300000:30000);
  child.stdout.setEncoding('utf8');child.stdout.on('data',(chunk:string)=>{size+=Buffer.byteLength(chunk);if(size>4*1024*1024)fail('Local video response exceeds its bound');else output+=chunk.toString();});child.stderr.on('data',()=>{/* Never echo process/provider environment or raw diagnostic output. */});child.on('error',()=>fail('Local video worker is unavailable'));child.stdin.on('error',()=>{/* Completion handler reports the worker outcome. */});child.on('close',()=>{clearTimeout(timer);if(settled)return;settled=true;try{const value=JSON.parse(output);if(!value.ok)reject(Error(String(value.error||'Local video action failed').slice(0,1200)));else resolve(value.result);}catch{reject(Error('Local video worker returned no valid result; no hosted operation ran.'));}});child.stdin.end(serialized);
 });
}
