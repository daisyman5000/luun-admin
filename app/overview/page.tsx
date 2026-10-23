import {canViewFinancials, requireUser} from '@/lib/auth';
import {actualDay, validDay} from '@/lib/forecast-actual';
import {FUNNEL_STAGES} from '@/lib/funnel';
import {funnelReport} from '@/lib/funnel-server';

export const dynamic = 'force-dynamic';
const labels = {landing: 'Visits', product_view: 'Viewed a sofa', configuration: 'Configured a sofa', checkout_start: 'Checkout opened', purchase: 'Paid order'};

export default async function OverviewPage({searchParams}: {searchParams: Promise<{from?: string; through?: string}>}) {
  const {profile} = await requireUser();
  if (!canViewFinancials(profile?.role)) return <main className="p-8">Owner/admin access required.</main>;
  const today = actualDay(new Date().toISOString());
  const query = await searchParams;
  const from = query.from || today.slice(0, 7) + '-01';
  const through = query.through || today;
  const valid = validDay(from) && validDay(through) && through >= from && through <= today && Date.parse(through) - Date.parse(from) <= 31 * 86400000;
  let report: Awaited<ReturnType<typeof funnelReport>> | null = null;
  let error = valid ? '' : 'Choose up to 32 days through today.';
  if (valid) {
    try { report = await funnelReport(from, through); }
    catch { error = 'Funnel metrics are unavailable. Try refreshing.'; }
  }
  const analysis = report?.analysis;
  return <main className="mx-auto max-w-6xl px-5 py-8">
    <h1 className="text-2xl font-semibold">Funnel overview</h1>
    <form action="/overview" className="my-6 flex flex-wrap items-end gap-4">
      <label className="text-sm">From<input name="from" type="date" defaultValue={from} max={today} className="mt-1 block rounded border p-2" /></label>
      <label className="text-sm">Through<input name="through" type="date" defaultValue={through} max={today} className="mt-1 block rounded border p-2" /></label>
      <button className="rounded bg-slate-950 px-4 py-2 text-white">Update</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {analysis && <>
      <div className="grid gap-3 sm:grid-cols-5">{FUNNEL_STAGES.map((stage, i) => <section key={stage} className="rounded-xl border bg-white p-4">
        <h2 className="text-sm text-slate-600">{labels[stage]}</h2>
        <p className="mt-2 text-3xl font-semibold">{analysis.trackedSessions ? analysis.counts[i] : '—'}</p>
      </section>)}</div>
      {!analysis.trackedSessions && <p className="mt-4 text-sm text-slate-600">No tracked funnel sessions in this period. Conversion is unknown.</p>}
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Conversion by step</h2>
        <div className="overflow-auto"><table className="mt-4 w-full text-left text-sm">
          <thead><tr><th className="p-2">Step</th><th>Entered</th><th>Continued</th><th>Conversion</th><th>Lost</th></tr></thead>
          <tbody>{analysis.steps.map(step => <tr className="border-t" key={step.to}>
            <td className="p-2">{labels[step.from]} → {labels[step.to]}</td>
            <td>{analysis.trackedSessions ? step.entered : '—'}</td><td>{analysis.trackedSessions ? step.continued : '—'}</td>
            <td>{step.conversion === null ? 'Unknown' : (step.conversion * 100).toFixed(1) + '%'}</td>
            <td>{analysis.trackedSessions ? step.lost : '—'}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="mt-4 text-sm text-slate-600">{analysis.bottleneck
          ? `Biggest measured drop-off: ${labels[analysis.bottleneck.from]} → ${labels[analysis.bottleneck.to]}. ${analysis.bottleneck.matureLost} of ${analysis.bottleneck.matureEntered} mature sessions did not continue.`
          : 'Not enough evidence to identify the biggest bottleneck: at least 100 entrants and 24 hours of observation are needed.'}</p>
      </section>
      <p className="mt-4 text-xs text-slate-500">Saved same-session events · Vancouver landing day · Configuration means builder interaction, not cart addition. Website tracking remains disabled. This overview only reads saved metrics.</p>
    </>}
  </main>;
}
