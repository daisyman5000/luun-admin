export type SourceJobResult={complete:boolean;recordCount:number;payload:unknown;cursor?:Record<string,unknown>;sourceUpdatedAt?:string|null;coverageFrom?:string|null;coverageTo?:string|null;warnings:string[]};
export type SourceState={last_success_at:string|null;cursor:Record<string,unknown>;payload:unknown};
export type SourceSyncRepository={claim(source:string,scope:string,runId:string):Promise<boolean>;read(source:string,scope:string):Promise<SourceState|null>;finish(source:string,scope:string,runId:string,result:SourceJobResult|null,error:string|null):Promise<void>};
export type SourceJobReport={source:string;status:'ok'|'partial'|'error'|'skipped';records?:number;phase?:'claim'|'read'|'finish'};
export async function runSourceJobs(jobs:{source:string;scope:string;read:(state:SourceState|null)=>Promise<SourceJobResult>}[],repo:SourceSyncRepository,newId:()=>string){
 const reports:SourceJobReport[]=[];
 for(const job of jobs){
  const runId=newId();let claimed:boolean;
  try{claimed=await repo.claim(job.source,job.scope,runId);}catch{reports.push({source:job.source,status:'error',phase:'claim'});continue;}
  if(!claimed){reports.push({source:job.source,status:'skipped'});continue;}
  let result:SourceJobResult|null=null,error:string|null=null;
  try{result=await job.read(await repo.read(job.source,job.scope));}catch{error='Source refresh failed; prior successful data retained.';}
  // Finalize once. An uncertain storage result must not trigger a second conflicting write.
  try{await repo.finish(job.source,job.scope,runId,result,error);}catch{reports.push({source:job.source,status:'error',phase:'finish'});continue;}
  reports.push(error?{source:job.source,status:'error',phase:'read'}:{source:job.source,status:result!.complete?'ok':'partial',records:result!.recordCount});
 }
 return reports;
}
/** Core polling health is separate from optional bank billing evidence and daily actual coverage. */
export function sourceSyncResponse(reports:SourceJobReport[]){const core=['wise_balances','shopify_orders'],ok=core.every(source=>reports.some(r=>r.source===source&&r.status==='ok'));return {statusCode:ok?200:503,body:{ok,status:ok?(reports.every(r=>r.status==='ok')?'ok':'partial'):'error',reports,coverageNotice:'Successful incremental polling does not establish complete daily sales, settled collections or actual ad delivery.'}};}
export function incrementalSince(lastSuccess:string|null,now:number){const floor=now-59*86400000;const previous=lastSuccess?Date.parse(lastSuccess):NaN;return new Date(Math.max(floor,Number.isFinite(previous)?previous-2*86400000:now-7*86400000)).toISOString();}
