"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { JobTicket, JobTicketCategory, JobTicketPriority, JobTicketStatus } from "@/lib/types";

const categories: { label: string; value: JobTicketCategory }[] = [
  { label: "Customer inquiry/messages", value: "customer_inquiry" },
  { label: "Ads created", value: "ads_created" },
  { label: "Customer followup/reviews", value: "customer_followup_reviews" },
  { label: "Social media posts", value: "social_media_posts" },
  { label: "Technology improvements", value: "technology_improvements" }
];

const statuses: { label: string; value: JobTicketStatus }[] = [
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" }
];

const priorities: { label: string; value: JobTicketPriority }[] = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" }
];

type DraftJob = {
  category: JobTicketCategory;
  customer_email: string;
  customer_name: string;
  details: string;
  due_at: string;
  next_step: string;
  order_number: string;
  owner_name: string;
  priority: JobTicketPriority;
  title: string;
};

function emptyDraft(category: JobTicketCategory): DraftJob {
  return {
    category,
    customer_email: "",
    customer_name: "",
    details: "",
    due_at: "",
    next_step: "",
    order_number: "",
    owner_name: "",
    priority: "normal",
    title: ""
  };
}

function categoryLabel(value: JobTicketCategory) {
  return categories.find((category) => category.value === value)?.label || value;
}

function statusLabel(value: JobTicketStatus) {
  return statuses.find((status) => status.value === value)?.label || value;
}

function formatDate(value?: string | null) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function JobsBoard({ canEdit, jobs }: { canEdit: boolean; jobs: JobTicket[] }) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<JobTicketCategory>(categories[0].value);
  const [draft, setDraft] = useState<DraftJob>(() => emptyDraft(categories[0].value));
  const [expandedId, setExpandedId] = useState(jobs[0]?.id || "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => job.category === activeCategory),
    [activeCategory, jobs]
  );

  function switchCategory(category: JobTicketCategory) {
    setActiveCategory(category);
    setDraft((currentDraft) => ({ ...emptyDraft(category), owner_name: currentDraft.owner_name }));
    setExpandedId("");
    setMessage("");
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/jobs", {
      body: JSON.stringify({ ...draft, status: "open" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(body.error || "Unable to create job");
      setSaving(false);
      return;
    }

    setDraft(emptyDraft(activeCategory));
    setMessage("Job created.");
    setSaving(false);
    router.refresh();
  }

  async function updateJob(id: string, updates: Partial<JobTicket>) {
    setMessage("");

    const response = await fetch(`/api/jobs/${id}`, {
      body: JSON.stringify(updates),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(body.error || "Unable to update job");
      return;
    }

    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-line bg-white p-4 shadow-sm">
        <p className="px-2 text-xs font-semibold uppercase tracking-normal text-slate-500">Job queues</p>
        <div className="mt-3 space-y-2">
          {categories.map((category) => {
            const count = jobs.filter((job) => job.category === category.value && job.status !== "done").length;
            const isActive = activeCategory === category.value;

            return (
              <button
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-semibold",
                  isActive
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-transparent bg-white text-slate-700 hover:border-line hover:bg-slate-50"
                ].join(" ")}
                key={category.value}
                onClick={() => switchCategory(category.value)}
                type="button"
              >
                <span>{category.label}</span>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500">{count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="space-y-5">
        {canEdit ? (
          <form className="rounded-[28px] border border-line bg-white p-5 shadow-sm" onSubmit={createJob}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_180px_180px]">
              <label className="text-sm font-medium text-slate-700">
                Job
                <input
                  className="mt-2 w-full rounded-lg px-4 py-3"
                  onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                  placeholder="What needs to happen?"
                  required
                  value={draft.title}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Priority
                <select
                  className="mt-2 w-full rounded-lg px-4 py-3"
                  onChange={(event) =>
                    setDraft((currentDraft) => ({ ...currentDraft, priority: event.target.value as JobTicketPriority }))
                  }
                  value={draft.priority}
                >
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Due
                <input
                  className="mt-2 w-full rounded-lg px-4 py-3"
                  onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, due_at: event.target.value }))}
                  type="date"
                  value={draft.due_at}
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <input
                className="rounded-lg px-4 py-3"
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, customer_name: event.target.value }))}
                placeholder="Customer name"
                value={draft.customer_name}
              />
              <input
                className="rounded-lg px-4 py-3"
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, customer_email: event.target.value }))}
                placeholder="Customer email"
                value={draft.customer_email}
              />
              <input
                className="rounded-lg px-4 py-3"
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, order_number: event.target.value }))}
                placeholder="Order number"
                value={draft.order_number}
              />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <textarea
                className="rounded-lg px-4 py-3"
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, details: event.target.value }))}
                placeholder="Details, messages, links, context"
                value={draft.details}
              />
              <textarea
                className="rounded-lg px-4 py-3"
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, next_step: event.target.value }))}
                placeholder="Next step"
                value={draft.next_step}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{message}</p>
              <button
                className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? "Saving..." : "Create job"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="rounded-[28px] border border-line bg-white shadow-sm">
          <div className="border-b border-line p-5">
            <h2 className="text-lg font-semibold text-slate-950">{categoryLabel(activeCategory)}</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredJobs.length} jobs</p>
          </div>
          <div className="divide-y divide-line">
            {filteredJobs.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No jobs in this queue.</div>
            ) : (
              filteredJobs.map((job) => {
                const isExpanded = expandedId === job.id;

                return (
                  <article className="p-5" key={job.id}>
                    <button
                      className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-start lg:justify-between"
                      onClick={() => setExpandedId(isExpanded ? "" : job.id)}
                      type="button"
                    >
                      <span>
                        <span className="block text-base font-semibold text-slate-950">{job.title}</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {formatDate(job.due_at)} · {job.customer_name || job.customer_email || job.order_number || "No customer linked"}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                          {job.priority}
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {statusLabel(job.status)}
                        </span>
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-3">
                          <div>
                            <p className="font-semibold text-slate-800">Details</p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-600">{job.details || "No details added."}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Next step</p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-600">{job.next_step || "No next step added."}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <p className="text-slate-600">Customer: {job.customer_name || "None"}</p>
                            <p className="text-slate-600">Email: {job.customer_email || "None"}</p>
                            <p className="text-slate-600">Order: {job.order_number || "None"}</p>
                          </div>
                        </div>

                        {canEdit ? (
                          <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700">
                              Status
                              <select
                                className="mt-2 w-full rounded-lg px-3 py-2"
                                onChange={(event) => updateJob(job.id, { status: event.target.value as JobTicketStatus })}
                                value={job.status}
                              >
                                {statuses.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Priority
                              <select
                                className="mt-2 w-full rounded-lg px-3 py-2"
                                onChange={(event) => updateJob(job.id, { priority: event.target.value as JobTicketPriority })}
                                value={job.priority}
                              >
                                {priorities.map((priority) => (
                                  <option key={priority.value} value={priority.value}>
                                    {priority.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
