'use client';
import {useEffect,useState} from 'react';
export type PublicSalePreview={active:boolean;endsAt:string|null};
export function WebsiteSalePreview({sale}:{sale:PublicSalePreview}){
 const [end,setEnd]=useState('');
 useEffect(()=>{if(sale.endsAt){const d=new Date(sale.endsAt);setEnd(new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16));}},[sale.endsAt]);
 return <section data-readonly-sale className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Website sale</h2><p className="mt-1 text-xs text-slate-500">Extra 35% after quantity savings · builder modules only</p></div><span role="status" className={sale.active?'rounded-full bg-green-50 px-3 py-1 text-xs text-green-800':'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600'}>{sale.active?'Live at last read':'Off at last read'}</span></div><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-slate-500">Sale ends<input type="datetime-local" value={end} disabled className="mt-1 block rounded-lg border border-line p-2.5 text-sm text-slate-950"/></label><button disabled className="rounded-lg border border-line px-5 py-2.5 text-sm opacity-40">{sale.active?'End sale':'Start sale now'}</button></div><p className="mt-2 text-xs text-slate-500">Read-only local preview from the public storefront endpoint. Use the authenticated admin to change the sale. Time uses your device’s time zone.</p></section>;
}
