// Chunk metadata is pinned to the retained original; no paid authorization is granted here.
export type IdeaChunk={id:string;hash:string;start:number;seconds:number};
export type IdeaCoverage={captureSeconds:number;decodedSeconds:number;encodedSeconds:number};
export type LongIdea={coverage?:IdeaCoverage;audioHash:string;seconds:number;chunks:Record<string,IdeaChunk>;completed:Record<string,{text:string;words:{word:string;start:number;end:number}[]}>};
export function ideaChunkPlan(seconds:number){if(!Number.isFinite(seconds)||seconds<=0||seconds>14400)throw Error('Invalid idea duration');return Array.from({length:Math.ceil(seconds/120)},(_,index)=>({index,start:index*120,seconds:Math.min(120,seconds-index*120)}));}
export function ideaChunkSpec(seconds:number,index:number){const spec=ideaChunkPlan(seconds)[index];if(!Number.isInteger(index)||!spec)throw Error('Invalid idea chunk');return spec;}
export function ideaUploadSpec(capture:number,index:number,seconds:number,coverage?:IdeaCoverage){
 const original=ideaChunkSpec(capture,index);if(!coverage){if(Math.abs(seconds-original.seconds)>.00003)throw Error('Idea chunk timing changed');return original;}
 if(index!==ideaChunkPlan(capture).length-1||coverage.captureSeconds!==capture||!Number.isFinite(coverage.decodedSeconds)||!Number.isFinite(coverage.encodedSeconds)||coverage.encodedSeconds<=0||Math.abs(coverage.decodedSeconds-capture)>1||Math.abs(coverage.encodedSeconds-coverage.decodedSeconds)>1)throw Error('Decoded idea coverage differs from the retained source');
 const decoded=ideaChunkSpec(coverage.decodedSeconds,index);if(ideaChunkPlan(coverage.decodedSeconds).length!==ideaChunkPlan(capture).length||Math.abs(seconds-decoded.seconds)>.00003)throw Error('Decoded tail does not match its WAV sample duration');return decoded;
}
export function fullIdeaTranscript(note:LongIdea){const plan=ideaChunkPlan(note.seconds);if(plan.some(c=>!note.completed[c.index]))return undefined;const words=plan.flatMap(c=>note.completed[c.index].words.map(w=>({...w,start:w.start+c.start,end:w.end+c.start})));return {text:plan.map(c=>note.completed[c.index].text).join(' '),words};}

export async function prepareIdeaChunks<T extends {ideaVoice?:{id:string;audioHash:string;seconds:number};longIdea?:LongIdea}>(project:T,upload:(p:T,spec:ReturnType<typeof ideaChunkSpec>)=>Promise<T>,progress?:(p:T)=>void){
 const voice=project.ideaVoice;if(!voice)throw Error('No retained idea recording');const source={...voice};let current=project;
 for(const spec of ideaChunkPlan(source.seconds)){
  const existing=current.longIdea?.audioHash===source.audioHash?current.longIdea.chunks[spec.index]:undefined,expected=ideaChunkSpec(current.longIdea?.coverage?current.longIdea.seconds:source.seconds,spec.index);
  if(existing&&existing.start===expected.start&&Math.abs(existing.seconds-expected.seconds)<.00003)continue;
  current=await upload(current,spec);
  if(current.ideaVoice?.id!==source.id||current.ideaVoice.audioHash!==source.audioHash||current.ideaVoice.seconds!==source.seconds)throw Error('Original idea changed during preparation');
  const chunk=current.longIdea?.audioHash===source.audioHash?current.longIdea.chunks[spec.index]:undefined;
  if(!chunk||chunk.start!==spec.start||Math.abs(chunk.seconds-ideaChunkSpec(current.longIdea!.seconds,spec.index).seconds)>.00003)throw Error('Prepared audio checkpoint is incomplete');progress?.(current);
 }
 return current;
}
