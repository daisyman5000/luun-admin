import { renderDemandPage } from '@/lib/demand-page';
export const dynamic = 'force-dynamic';
export default async function DemandPage() { return renderDemandPage(false); }
