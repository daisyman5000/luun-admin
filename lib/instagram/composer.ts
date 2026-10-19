import {localDateKey} from '../content-calendar';
import {emptyPost,type ContentPost,type PostDraft} from '../content';
export function composerPayload(draft:PostDraft,status:'draft'|'approved',previous:ContentPost|null){
 const caption=draft.caption.trim();
 if(status==='approved'&&(!caption||!/^instagram-media:[a-f0-9-]{36}$/.test(draft.assetReference)||!draft.plannedAt||!Number.isFinite(Date.parse(draft.plannedAt))||Date.parse(draft.plannedAt)<=Date.now()))throw Error('Choose an uploaded image and caption, with a future calendar placement.');
 const plannedAt=draft.plannedAt?new Date(draft.plannedAt).toISOString():'';
 return {...emptyPost,...draft,title:previous?.title||caption.split('\n')[0].slice(0,160)||'Instagram post',objective:previous?.objective||'Instagram post',brief:previous?.brief||'',dueDate:previous?.dueDate||draft.dueDate||'',completionEvidence:previous?.completionEvidence||'',channel:'Instagram' as const,plannedAt,status,...(previous?{id:previous.id,version:previous.version}:{})};
}
export async function saveComposer(draft:PostDraft,previous:ContentPost|null,schedule:boolean,ports:{save:(body:ReturnType<typeof composerPayload>)=>Promise<ContentPost>;queue:(post:ContentPost)=>Promise<void>;saved:(post:ContentPost)=>void}){
 // Edits invalidate the old approval/queue. The Schedule click approves this exact new revision.
 const saved=await ports.save(composerPayload(draft,'draft',previous));ports.saved(saved);
 if(!schedule)return saved;
 const approved=await ports.save(composerPayload({...saved},'approved',saved));ports.saved(approved);
 await ports.queue(approved);return approved;
}
export function composerLabel(post:ContentPost,publishingReady:boolean){
 if(post.delivery?.state==='published'||post.status==='published')return 'Published';
 if(post.delivery?.state==='failed')return 'Failed';
 if(post.delivery?.state==='reconciling')return 'Checking confirmation';
 if(post.delivery&&['queued','creating','processing','publishing'].includes(post.delivery.state))return publishingReady?'Scheduled':'Paused';
 return 'Draft';
}

export function publishNowPlacement(draft:PostDraft,now=Date.now()):PostDraft{
 if(draft.plannedAt)return draft;
 const next=now+60000;
 if(draft.dueDate!==localDateKey(new Date(now))||draft.dueDate!==localDateKey(new Date(next)))throw Error('Choose a calendar placement before scheduling.');
 // Explicit Publish now starts at the next worker opportunity; it is never a future-day default.
 return {...draft,plannedAt:new Date(next).toISOString()};
}
