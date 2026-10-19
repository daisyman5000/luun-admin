import {randomUUID} from 'node:crypto';
import {publicationSnapshot,snapshotHash,snapshotStillApproved} from './core';
import {jobPorts,type instagramServer} from './server';
import {runForegroundPublication} from './foreground';
import type {PublishJob} from './worker';
export async function publishApprovedNow(s:ReturnType<typeof instagramServer>,actor:string,id:string,version:number){
 await s.operations.requireEnabled('publishing');
 const post=await s.currentPost(id);if(post.version!==version)throw Error('instagram_post_changed');
 const find=async()=>{const r=await s.db.from('instagram_publish_jobs').select('*').eq('account_id',s.config.accountId).eq('post_id',id).eq('post_version',version).maybeSingle();if(r.error)throw Error('instagram_storage_unavailable');return r.data as (PublishJob&{lease_until:string|null;scheduled_at:string})|null;};
 let job=await find();
 if(!job){
  // Only this explicitly selected immediate post; never drain another queued item.
  const time=Date.parse(post.plannedAt);if(!Number.isFinite(time)||time<=Date.now()||time>Date.now()+120000)throw Error('instagram_immediate_placement_required');
  const media=await s.media(post.assetReference.replace(/^instagram-media:/,'')),snapshot=publicationSnapshot(post,media,s.config.accountId);
  await s.rpc('enqueue_instagram_publish_job',{p_actor:actor,p_snapshot:snapshot,p_hash:snapshotHash(snapshot)});job=await find();
 }
 if(!job||job.snapshot.postId!==id||job.snapshot.postVersion!==version||!snapshotStillApproved(post,job.snapshot)||snapshotHash(job.snapshot)!==job.approval_hash)throw Error('instagram_approval_changed');
 if(['published','failed','cancelled'].includes(job.state))return {status:job.state};
 if(job.state==='queued'&&Date.parse(job.snapshot.scheduledAt)>Date.now()+120000)return {status:'future'};
 const lease=randomUUID(),now=new Date().toISOString();
 const claimed=await s.db.from('instagram_publish_jobs').update({lease_id:lease,lease_until:new Date(Date.now()+240000).toISOString(),attempts:job.attempts+1,updated_at:now}).eq('id',job.id).eq('account_id',s.config.accountId).eq('post_id',id).eq('post_version',version).eq('state',job.state).eq('attempts',job.attempts).or('lease_until.is.null,lease_until.lt.'+now).select('id').maybeSingle();
 if(claimed.error)throw Error('instagram_storage_unavailable');if(!claimed.data)return {status:'busy'};
 const specificId=job.id,base=jobPorts(s).ports;
 const ports={...base,claim:async()=>{const r=await s.db.from('instagram_publish_jobs').select('*').eq('id',specificId).eq('account_id',s.config.accountId).eq('lease_id',lease).maybeSingle();if(r.error)throw Error('instagram_storage_unavailable');if(!r.data||Date.parse(r.data.lease_until)<=Date.now())return null;return r.data as PublishJob;},api:{...base.api,permalink:async()=>null}};
 try{return await runForegroundPublication(ports);}finally{try{await s.rpc('release_instagram_publish_job',{p_id:specificId,p_lease:lease});}catch{/* The short lease expires; never release a different caller's lease. */}}
}
