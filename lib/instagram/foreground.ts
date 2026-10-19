import {runInstagramJob,type WorkerPorts} from './worker';
/** One owner-requested invocation. No background continuation, scheduler, or provider retry. */
export async function runForegroundPublication(ports:WorkerPorts,clock=()=>Date.now(),sleep:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 const deadline=clock()+150000;
 while(clock()<deadline){
  const job=await ports.claim();if(!job)return {status:'busy'};
  if(['published','failed','cancelled'].includes(job.state))return {status:job.state};
  const until=Date.parse(job.snapshot.scheduledAt)-clock();
  if(job.state==='queued'&&until>120000)return {status:'future'};
  if(job.state==='queued'&&until>0){await sleep(Math.min(2000,until));continue;}
  // Each provider call is bounded to 20s; reserve token refresh + status + publish.
  if(deadline-clock()<(job.state==='processing'?75000:45000))return {status:'pending'};
  const result=await runInstagramJob(true,ports);
  if(result.status!=='processing')return result;
  await sleep(1500);
 }
 return {status:'pending'};
}
