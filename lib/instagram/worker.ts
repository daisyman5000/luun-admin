import {sha256,snapshotHash,snapshotStillApproved,type ApprovedSnapshot,type JobState} from './core';
import {InstagramError} from './client';
import type {ContentPost} from '../content';
export type PublishJob={id:string;state:JobState;snapshot:ApprovedSnapshot;approval_hash:string;container_id:string|null;media_id:string|null;lease_id:string;attempts:number};
export type JobPatch={state:JobState;container_id?:string;media_id?:string;permalink?:string|null;error_code?:string|null};
export type WorkerPorts={claim:()=>Promise<PublishJob|null>;save:(j:PublishJob,p:JobPatch)=>Promise<void>;begin:(j:PublishJob)=>Promise<void>;post:(id:string)=>Promise<ContentPost>;token:()=>Promise<string>;media:(s:ApprovedSnapshot)=>Promise<{bytes:Buffer;url:string}>;api:{create:(t:string,url:string,caption:string)=>Promise<string>;status:(t:string,id:string)=>Promise<string>;publish:(t:string,id:string)=>Promise<string>;permalink:(t:string,id:string)=>Promise<string|null>}};
/** One durable stage per invocation; persist each unsafe boundary before sending. */
export async function runInstagramJob(enabled:boolean,p:WorkerPorts){
 if(!enabled)return {status:'disabled'};
 const j=await p.claim();if(!j)return {status:'idle'};
 let createdId:string|undefined,publishedId:string|undefined,confirmedPublished=false;
 let unsafe=j.state==='creating'||j.state==='publishing'||j.state==='reconciling';
 const save=(patch:JobPatch)=>p.save(j,patch);
 try{
  if(j.state==='creating'||j.state==='reconciling'&&!j.container_id){await save({state:'reconciling',error_code:'instagram_creation_outcome_unknown'});return {status:'reconciling'};}
  const token=await p.token();
  if(j.state==='reconciling'||j.state==='publishing'){
   const state=await p.api.status(token,j.container_id!);if(state==='PUBLISHED'){confirmedPublished=true;await save({state:'published',error_code:null});return {status:'published'};}
   await save({state:'reconciling',error_code:'instagram_publication_outcome_unknown'});return {status:'reconciling'};
  }
  if(j.state==='queued'){
   if(Date.now()-Date.parse(j.snapshot.scheduledAt)>15*60000)throw new InstagramError('instagram_publish_window_missed');
   const post=await p.post(j.snapshot.postId);if(!snapshotStillApproved(post,j.snapshot)||snapshotHash(j.snapshot)!==j.approval_hash)throw new InstagramError('instagram_approval_changed');
   const media=await p.media(j.snapshot);if(sha256(media.bytes)!==j.snapshot.media.sha256)throw new InstagramError('instagram_media_changed');
   await p.begin(j);unsafe=true;const id=await p.api.create(token,media.url,j.snapshot.caption);createdId=id;await save({state:'processing',container_id:id,error_code:null});return {status:'processing'};
  }
  if(j.state==='processing'){
   if(!j.container_id)throw new InstagramError('instagram_container_missing');
   const state=await p.api.status(token,j.container_id);
   if(state==='PUBLISHED'){confirmedPublished=true;await save({state:'published',error_code:null});return {status:'published'};}
   if(state==='IN_PROGRESS'){await save({state:'processing'});return {status:'processing'};}
   if(state!=='FINISHED')throw new InstagramError('instagram_container_'+state.toLowerCase());
   if(Date.now()-Date.parse(j.snapshot.scheduledAt)>15*60000)throw new InstagramError('instagram_publish_window_missed');
   await save({state:'publishing',error_code:null});unsafe=true;
   const id=await p.api.publish(token,j.container_id);publishedId=id;confirmedPublished=true;await save({state:'published',media_id:id,error_code:null});
   // Publication is already durable; a missing permalink must not cause a duplicate.
   try{const url=await p.api.permalink(token,id);if(url)await save({state:'published',media_id:id,permalink:url});}catch{/* Metadata can be reconciled separately. */}
   return {status:'published'};
  }
  return {status:j.state};
 }catch(error){
  // A positive provider acknowledgement can be persisted again, never resent.
  // A second storage failure bubbles out; the existing durable stage still blocks duplicates.
  if(confirmedPublished){await save({state:'published',...(publishedId?{media_id:publishedId}:{}),error_code:null});return {status:'published'};}
  if(createdId){await save({state:'processing',container_id:createdId,error_code:null});return {status:'processing'};}
  const known=error instanceof InstagramError,errorCode=known?error.code:'instagram_worker_unavailable';
  const uncertain=unsafe&&(!known||error.uncertain||j.state==='publishing'||j.state==='reconciling'||j.state==='creating');
  await save({state:uncertain?'reconciling':'failed',error_code:errorCode});return {status:uncertain?'reconciling':'failed'};
 }
}
