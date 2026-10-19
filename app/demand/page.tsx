import {headers} from 'next/headers';
import {WebsiteSalePreview,type PublicSalePreview} from '@/components/website-sale-preview';
import {DemandSaleControl} from '@/components/demand-sale-control';
import {canManageInventory,canViewFinancials,requireUser} from '@/lib/auth';
import {localContentEnabled} from '@/lib/local-content';
import {readSale} from '@/lib/sales/store';
export const dynamic='force-dynamic';
export default async function SalesPage(){
 const local=localContentEnabled((await headers()).get('host'));
 let canEdit=false;
 if(!local){const {profile}=await requireUser();if(!canViewFinancials(profile?.role))return <main className="p-8"><h1 className="text-2xl font-semibold">Sales</h1><p className="mt-3">Owner/admin access required.</p></main>;canEdit=canManageInventory(profile?.role);}
 if(local){let preview:PublicSalePreview|null=null;try{const r=await fetch('https://luun-admin-et42.vercel.app/api/public-sale',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.ok){const d=await r.json();if(d.version===1&&typeof d.active==='boolean'&&(d.endsAt===null||typeof d.endsAt==='string'&&Number.isFinite(Date.parse(d.endsAt))))preview={active:d.active,endsAt:d.endsAt};}}catch{}return <main data-sales-view className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><h1 className="mb-5 text-2xl font-semibold tracking-tight">Sales</h1>{preview?<WebsiteSalePreview sale={preview}/>:<p role="alert">Website sale status unavailable. No sale change was made.</p>}</main>;}
 let sale=null,unavailable=false;
 try{sale=await readSale();}catch{unavailable=true;}
 return <main data-sales-view className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><h1 className="mb-5 text-2xl font-semibold tracking-tight">Sales</h1>{unavailable?<p role="alert" className="rounded-xl border border-line bg-white p-5 text-sm">Sale status unavailable. The sale has not been changed. Refresh after the existing connection is available.</p>:<><DemandSaleControl canEdit={canEdit} initialSale={sale}/></>}</main>;
}
