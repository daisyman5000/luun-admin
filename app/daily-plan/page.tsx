import { renderDemandPage } from '@/lib/demand-page';
export const dynamic = 'force-dynamic';
export default async function DailyPlanPage() { return renderDemandPage(true); }
