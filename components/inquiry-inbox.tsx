"use client";

import { useEffect, useState } from "react";
import type { JobTicket, JobTicketStatus } from "@/lib/types";

const labels: Record<JobTicketStatus,string> = { open: "New", in_progress: "In progress", blocked: "Waiting", done: "Resolved" };
const date = (value: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" }).format(new Date(value));

export function InquiryInbox({ initialTickets, initialHasMore, initialError, canEdit }: {
  initialTickets: JobTicket[]; initialHasMore: boolean; initialError: string | null; canEdit: boolean;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const ticket = tickets.find(item => item.id === selected);
  const visible = tickets.filter(item => (filter === "all" || (filter === "done" ? item.status === "done" : item.status !== "done")) &&
    [item.customer_name, item.customer_email, item.title, item.details].some(value => value?.toLowerCase().includes(search.toLowerCase())));

  async function load(more = false) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/inquiries?offset=${more ? tickets.length : 0}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load inquiries");
      setTickets(old => more ? [...new Map([...old,...body.tickets].map(item => [item.id,item])).values()] : body.tickets);
      setHasMore(body.hasMore);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load inquiries"); }
    finally { setBusy(false); }
  }

  // Poll only the newest batch; retain older loaded messages and current selection.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/inquiries", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        setTickets(old => [...new Map([...old,...body.tickets].map(item => [item.id,item])).values()]
          .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
      } catch { /* Manual refresh remains available. */ }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  async function updateStatus(status: JobTicketStatus) {
    if (!ticket) return;
    setUpdating(true); setError(null);
    try {
      const response = await fetch(`/api/jobs/${ticket.id}`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update inquiry");
      setTickets(old => old.map(item => item.id === body.id ? body : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update inquiry"); }
    finally { setUpdating(false); }
  }

  const details = ticket?.details?.split("\n\n— Webflow inquiry —\n") || [];
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Inquiry filters">
        {[["active","Open"],["done","Resolved"],["all","All"]].map(([value,label]) =>
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Search inquiries" placeholder="Search inquiries" value={search} onChange={event => setSearch(event.target.value)} className="w-52 rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        <button disabled={busy} onClick={() => load()} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">{busy ? "Loading…" : "Refresh"}</button>
      </div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid overflow-hidden rounded-xl border border-line bg-white shadow-sm lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
      <div className="border-b border-line lg:border-b-0 lg:border-r">
        <div className="max-h-[70vh] overflow-y-auto">
          {visible.length ? visible.map(item => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}
            className={`block w-full border-b border-line p-5 text-left last:border-b-0 ${selected === item.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-3"><span className="truncate font-semibold text-slate-900">{item.customer_name || item.customer_email || "Website visitor"}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${item.status === "open" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{labels[item.status]}</span></div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.details?.split("\n\n— Webflow inquiry —\n")[0] || item.title}</p>
            <p className="mt-3 text-xs text-slate-400">{date(item.created_at)}</p>
          </button>) : <div className="px-6 py-12 text-center text-sm text-slate-500">{search ? "No matching inquiries." : "No inquiries here yet."}</div>}
        </div>
        {hasMore && <button disabled={busy} onClick={() => load(true)} className="w-full border-t border-line p-4 text-sm font-medium text-slate-700">Load older inquiries</button>}
      </div>
      <section className="min-w-0 p-6 sm:p-8" aria-label="Inquiry details">
        {ticket ? <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><h2 className="break-words text-xl font-semibold text-slate-900">{ticket.customer_name || "Website visitor"}</h2>
              <p className="mt-2 break-all text-sm text-slate-500">{ticket.customer_email || "No email supplied"}</p><p className="mt-2 text-xs text-slate-400">{date(ticket.created_at)}</p></div>
            <select aria-label="Inquiry status" value={ticket.status} disabled={!canEdit || updating} onChange={event => updateStatus(event.target.value as JobTicketStatus)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
              {Object.entries(labels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          <p className="my-8 whitespace-pre-wrap break-words text-base leading-7 text-slate-800">{details[0] || ticket.title}</p>
          {details[1] && <p className="mb-6 whitespace-pre-wrap break-words border-t border-line pt-4 text-xs leading-6 text-slate-400">{details[1]}</p>}
          {ticket.customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.customer_email) && <a href={`mailto:${encodeURIComponent(ticket.customer_email)}?subject=${encodeURIComponent("Re: Your Luun inquiry")}`} className="inline-flex rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white">Reply by email</a>}
        </> : <div className="py-16 text-center text-sm text-slate-400">Select an inquiry to read the message.</div>}
      </section>
    </div>
  </>;
}
