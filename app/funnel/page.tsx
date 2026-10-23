import {canViewFinancials,requireUser} from '@/lib/auth';
import {FunnelWorkspace} from '@/components/funnel-workspace';
export const dynamic='force-dynamic';
export default async function FunnelPage(){const {profile}=await requireUser();if(!canViewFinancials(profile?.role))return <main className="p-8">Owner/admin access required.</main>;return <main className="mx-auto max-w-6xl px-5 py-8"><FunnelWorkspace/></main>;}
