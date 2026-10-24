import Link from 'next/link';
import { ContentUGC } from '@/components/content-ugc';
import { ContentReferenceAdsPage } from '@/components/content-reference-ads-page';
import { ContentVideo } from '@/components/content-video';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { localContentEnabled } from '@/lib/local-content';
import { ContentPlanner } from '@/components/content-planner';
import { StudioIntegration } from '@/components/studio-integration';
export const dynamic='force-dynamic';
export default async function ContentPage({searchParams}:{searchParams:Promise<{view?:string}>}){
 const local=localContentEnabled((await headers()).get('host'));if(!local)await requireUser();
 const view=(await searchParams).view;
 const studio=view==='studio',video=view==='video',references=view==='references',ugc=view==='ugc';
 return <><nav aria-label="Content views" className="mx-5 mt-6 flex flex-wrap gap-2 border-b border-line pb-3 sm:mx-10"><Link href="/content" aria-current={!studio&&!video&&!references&&!ugc?'page':undefined} className={'rounded-lg px-4 py-2 text-sm '+(!studio&&!video&&!references&&!ugc?'bg-slate-950 text-white':'text-slate-500')}>Calendar</Link><Link href="/content?view=studio" aria-current={studio?'page':undefined} className={'rounded-lg px-4 py-2 text-sm '+(studio?'bg-slate-950 text-white':'text-slate-500')}>Image Studio</Link><Link href="/content?view=video" aria-current={video?'page':undefined} className={'rounded-lg px-4 py-2 text-sm '+(video?'bg-slate-950 text-white':'text-slate-500')}>Video</Link><Link href="/content?view=references" aria-current={references?'page':undefined} className={'rounded-lg px-4 py-2 text-sm '+(references?'bg-slate-950 text-white':'text-slate-500')}>Reference ads</Link><Link href="/content?view=ugc" aria-current={ugc?'page':undefined} className={'rounded-lg px-4 py-2 text-sm '+(ugc?'bg-slate-950 text-white':'text-slate-500')}>UGC videos</Link></nav>{ugc?<ContentUGC/>:references?<ContentReferenceAdsPage/>:video?<ContentVideo local={local}/>:studio?(process.env.NODE_ENV==='production'?<section className="mx-5 my-8 rounded-xl border border-line p-6 sm:mx-10"><h1 className="text-xl font-semibold">Image Studio runs on your Mac</h1><p className="mt-3 text-sm text-slate-600">Open the existing LUUN Creative Lab app on your Mac to create and review images. This hosted workspace cannot connect to the desktop Studio. Use the Calendar here to plan and review content packages.</p></section>:<StudioIntegration/>):<ContentPlanner local={local}/>}</>;
}
