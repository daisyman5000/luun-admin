import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SaleState } from './types';
export async function readSale() {
 const {data,error}=await createAdminClient().from('sale_control').select('*').eq('id',1).single<SaleState>();
 if(error || !data) throw new Error('Sale controls need the sale-control database migration.');
 return data;
}
export async function updateSale(version:number, patch:Partial<SaleState>, actor:string) {
 const {data,error}=await createAdminClient().from('sale_control').update({...patch,version:version+1,updated_by:actor,updated_at:new Date().toISOString()}).eq('id',1).eq('version',version).select('*').single<SaleState>();
 if(error || !data) throw new Error('Sale settings changed. Refresh before retrying.');
 return data;
}
export async function auditSale(action:string,actor:string,version:number) {
 const {error}=await createAdminClient().from('sale_control_audit').insert({action,actor,version});
 if(error) throw new Error('Unable to record sale operation.');
}
