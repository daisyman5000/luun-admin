import { InquiryInbox } from "@/components/inquiry-inbox";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import { inquiryStatuses } from "@/lib/inquiry-tickets";
import type { JobTicket } from "@/lib/types";

export default async function TicketingPage() {
  const { supabase, profile } = await requireUser();
  const { data, error } = await supabase.from("job_tickets").select("*")
    .eq("category", "customer_inquiry").eq("inquiry_status", "new").eq("is_test",false).order("last_activity_at", { ascending: false })
    .order("id", { ascending: false }).range(0,100).returns<JobTicket[]>();
  const totals = await Promise.all(Object.keys(inquiryStatuses).map(status=>supabase.from("job_tickets").select("id",{count:"exact",head:true}).eq("category","customer_inquiry").eq("is_test",false).eq("inquiry_status",status)));
  const initialCounts=Object.fromEntries(Object.keys(inquiryStatuses).map((status,index)=>[status,totals[index].count||0]));
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
    <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
    <p className="mt-2 mb-6 text-sm text-slate-500">Customer conversations and follow-ups.</p>
    <InquiryInbox initialTickets={(data || []).slice(0,100)} initialHasMore={(data || []).length > 100}
      initialError={error ? "Inquiries could not be loaded. Try refreshing." : null}
      initialCounts={initialCounts} canEdit={canUpdateOrderLogistics(profile?.role)} />
  </main>;
}
