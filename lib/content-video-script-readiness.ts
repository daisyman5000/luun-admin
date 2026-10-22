import {creatorScriptReservationMicrousd,reserveCreatorCost} from './content-video-creator-cost';
import type {CreatorState} from './content-video-creator';
import type {creatorProviders} from './content-video-creator-providers';
// Configuration and ledger inspection only. Never dispatches a model request or saves data.
export function scriptGenerationReadiness(p:CreatorState,providers:Pick<ReturnType<typeof creatorProviders>,'assert'|'quote'>){
 const additionalMicrousd=creatorScriptReservationMicrousd(),reservedMicrousd=Object.values(p.jobs||{}).reduce((n,j)=>n+(j.cost?.reservedMicrousd||0),0);
 let reason='';try{
  if(p.ideaVoice&&p.ideaTranscript?.audioHash!==p.ideaVoice.audioHash)throw Error('Transcribe the saved note before generating a script');
  if(Object.values(p.jobs||{}).some(j=>j.status==='pending'||j.status==='uncertain'))throw Error('Resolve the pending or uncertain provider request before generating a script');
  providers.assert('script');reserveCreatorCost(p.jobs,providers.quote('script',p.id));
 }catch(e){reason=e instanceof Error?e.message:'Script authorization is unavailable';}
 const message=reason?`${p.ideaTranscript?'Your transcript is saved. ':''}${reason} One script requires a separate allowance of up to US$${(additionalMicrousd/1000000).toFixed(2)}. No video generation is enabled by a script allowance.`:'Script authorization and project allowance are ready';
 return {authorized:!reason,message,additionalMicrousd,reservedMicrousd};
}
