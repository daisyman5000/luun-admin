import { InquiryInbox } from "@/components/inquiry-inbox";
import { canUpdateOrderLogistics, requireUser } from "@/lib/auth";
import type { JobTicket } from "@/lib/types";

export default async function TicketingPage() {
  const { supabase, profile } = await requireUser();
  const { data, error } = await supabase.from("job_tickets").select("*")
    .eq("category", "customer_inquiry").order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(0,100).returns<JobTicket[]>();
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
    <h1 className="text-2xl font-semibold text-slate-900">Inquiries</h1>
    <p className="mt-2 mb-6 text-sm text-slate-500">Customer messages from your website.</p>
    <InquiryInbox initialTickets={(data || []).slice(0,100)} initialHasMore={(data || []).length > 100}
      initialError={error ? "Inquiries could not be loaded. Try refreshing." : null}
      canEdit={canUpdateOrderLogistics(profile?.role)} />
  </main>;
}
