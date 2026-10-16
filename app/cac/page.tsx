import {requireUser,canViewFinancials} from '@/lib/auth';
import {AcquisitionSummary} from '@/components/acquisition-summary';
export const dynamic='force-dynamic';
export default async function CacPage(){const {profile}=await requireUser();if(!canViewFinancials(profile?.role))return <main className="p-8">Owner/admin access required.</main>;return <main className="mx-auto max-w-5xl p-8"><h1 className="mb-5 text-xl font-semibold">Historical advertising cost</h1><AcquisitionSummary/></main>;}
