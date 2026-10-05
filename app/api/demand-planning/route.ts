import { NextResponse, type NextRequest } from 'next/server';
import { getUserContext, canViewFinancials } from '@/lib/auth';
import { EMPTY_PLANNING, type PlanningSettings } from '@/lib/demand-plan';
export async function POST(request: NextRequest) {
 const { user, profile, supabase } = await getUserContext();
 if (!user) return NextResponse.json({ error: 'Sign in to save.' }, { status: 401 });
 if (!canViewFinancials(profile?.role)) return NextResponse.json({ error: 'Owner/admin access required.' }, { status: 403 });
 if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error:'Invalid request origin.' }, { status:403 });
 let body: PlanningSettings;
 try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid settings.' }, { status: 400 }); }
 const ranges: Record<keyof PlanningSettings, [number,number]> = { leadDays:[1,730], bufferDays:[0,180], costPerPaidOrder:[0.01,10000], organicOrders:[0,10000], saleLift:[1,20], maxBudget:[0,5000] };
 const settings = { ...EMPTY_PLANNING };
 for (const key of Object.keys(ranges) as (keyof PlanningSettings)[]) {
  const value = body?.[key]; const [min,max] = ranges[key];
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)) return NextResponse.json({ error: `Invalid ${key}.` }, { status: 400 });
  settings[key] = value;
 }
 const { error } = await supabase.from('demand_planning_settings').upsert({ id:1, settings, updated_by:user.id, updated_at:new Date().toISOString() });
 if (error) return NextResponse.json({ error:'Planning settings could not be saved. Check the planning database migration.' }, { status:500 });
 return NextResponse.json({ settings });
}
