// Chunk metadata is pinned to the retained original; no paid authorization is granted here.
export type IdeaChunk={id:string;hash:string;start:number;seconds:number};
export type LongIdea={audioHash:string;seconds:number;chunks:Record<string,IdeaChunk>;completed:Record<string,{text:string;words:{word:string;start:number;end:number}[]}>};
export function ideaChunkPlan(seconds:number){if(!Number.isFinite(seconds)||seconds<=0||seconds>14400)throw Error('Invalid idea duration');return Array.from({length:Math.ceil(seconds/120)},(_,index)=>({index,start:index*120,seconds:Math.min(120,seconds-index*120)}));}
export function ideaChunkSpec(seconds:number,index:number){const spec=ideaChunkPlan(seconds)[index];if(!Number.isInteger(index)||!spec)throw Error('Invalid idea chunk');return spec;}
export function fullIdeaTranscript(note:LongIdea){const plan=ideaChunkPlan(note.seconds);if(plan.some(c=>!note.completed[c.index]))return undefined;const words=plan.flatMap(c=>note.completed[c.index].words.map(w=>({...w,start:w.start+c.start,end:w.end+c.start})));return {text:plan.map(c=>note.completed[c.index].text).join(' '),words};}
