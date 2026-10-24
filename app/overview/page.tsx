import {canViewFinancials, requireUser} from '@/lib/auth';
import {OverviewAutoRefresh} from '@/components/overview-auto-refresh';
import {loadGA4Overview} from '@/lib/ga4-server';
import {GA4_EVENTS, GA4_LABELS, validGA4Range} from '@/lib/ga4';

export const dynamic = 'force-dynamic';
export default async function OverviewPage({searchParams}: {searchParams: Promise<{from?: string; through?: string}>}) {
  const {profile} = await requireUser();
  if (!canViewFinancials(profile?.role)) return <main className="p-8">Owner/admin access required.</main>;
  const day = (at: number) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));
  const query = await searchParams, today = day(Date.now());
  const from = query.from || day(Date.now() - 28 * 86400000), through = query.through || day(Date.now() - 86400000);
  const valid = validGA4Range(from, through) && through <= today;
  const {report, connection} = valid ? await loadGA4Overview(from, through) : {report: null, connection: 'Choose up to 32 days through today.'};
  const number = (n: number) => n.toLocaleString('en-CA');
  return <main className="mx-auto max-w-6xl px-5 py-8">
    <OverviewAutoRefresh />
    <h1 className="text-2xl font-semibold">Funnel overview</h1>
    <p className="mt-2 text-sm text-slate-600">Google Analytics · Luun</p>
    <form action="/overview" className="my-6 flex flex-wrap items-end gap-4">
      <label className="text-sm">From<input name="from" type="date" defaultValue={from} max={today} className="mt-1 block rounded border p-2" /></label>
      <label className="text-sm">Through<input name="through" type="date" defaultValue={through} max={today} className="mt-1 block rounded border p-2" /></label>
      <button className="rounded bg-slate-950 px-4 py-2 text-white">Update</button>
    </form>
    <p role="status" className="mb-4 text-sm text-slate-600">{connection}</p>
    {report ? <>
      <p className="mb-4 text-sm">{report.from} – {report.through}{report.timeZone ? ` · ${report.timeZone}` : ' · GA4 report dates'} · {report.source === 'api' ? 'Read from Google' : 'Imported from Google Analytics'}</p>
      {(report.from !== from || report.through !== through) && <p role="alert" className="mb-4 text-sm text-amber-800">The imported report covers the dates above. It cannot be filtered to your requested dates until the automatic connection is ready.</p>}
      {report.warning && <p role="alert" className="mb-4 text-sm text-amber-800">{report.warning}</p>}
      <div className="grid gap-3 sm:grid-cols-5">{GA4_EVENTS.map(name => {
        const event = report.events.find(e => e.name === name);
        return <section key={name} className="rounded-xl border bg-white p-4"><h2 className="text-sm text-slate-600">{GA4_LABELS[name]}</h2>
          <p className="mt-2 text-3xl font-semibold">{event ? number(event.count) : '—'}</p>
          <p className="mt-2 text-xs text-slate-500">{event ? `${number(event.users)} users` : 'Not recorded in this report'}</p>
        </section>;
      })}</div>
      {report.sessions !== null && <p className="mt-4 text-sm text-slate-600">{number(report.sessions)} sessions · {report.totalUsers === null ? 'Unknown' : number(report.totalUsers)} total users</p>}
      <p className="mt-5 text-sm text-slate-600">Actual GA4 event counts. Repeat actions are included. These totals do not establish an ordered funnel, so step conversion and the biggest bottleneck are not yet verified.</p>
      <p className="mt-3 text-xs text-slate-500">Read {new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Cancun', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(report.fetchedAt))} Cancún · Property {report.propertyId}</p>
    </> : <p role="alert">No Google Analytics report is available.</p>}
  </main>;
}
