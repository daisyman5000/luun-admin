import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

type JobRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  customer_name: string | null;
  customer_email: string | null;
  order_number: string | null;
  owner_name: string | null;
  details: string | null;
  next_step: string | null;
  due_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function createFakeJobsClient(store: JobRow[]) {
  return {
    from(table: string) {
      if (table !== "job_tickets") {
        throw new Error(`unexpected table ${table}`);
      }

      let action: "select" | "insert" | "update" = "select";
      let payload: Partial<JobRow> = {};
      let statusFilter: string[] | null = null;
      let idFilter: string | null = null;

      const builder = {
        select() {
          return builder;
        },
        insert(row: Partial<JobRow>) {
          action = "insert";
          payload = row;
          return builder;
        },
        update(row: Partial<JobRow>) {
          action = "update";
          payload = row;
          return builder;
        },
        in(field: string, values: string[]) {
          if (field === "status") statusFilter = values;
          return builder;
        },
        eq(field: string, value: string) {
          if (field === "id") idFilter = value;
          return builder;
        },
        order() {
          return builder;
        },
        returns() {
          return builder;
        },
        single() {
          return execute(true);
        },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) {
          return execute(false).then(resolve, reject);
        }
      };

      async function execute(single: boolean) {
        if (action === "insert") {
          const now = new Date().toISOString();
          const row = {
            id: crypto.randomUUID(),
            title: String(payload.title),
            category: String(payload.category),
            status: String(payload.status),
            priority: String(payload.priority),
            customer_name: payload.customer_name ?? null,
            customer_email: payload.customer_email ?? null,
            order_number: payload.order_number ?? null,
            owner_name: payload.owner_name ?? null,
            details: payload.details ?? null,
            next_step: payload.next_step ?? null,
            due_at: payload.due_at ?? null,
            created_by: payload.created_by ?? null,
            updated_by: payload.updated_by ?? null,
            created_at: now,
            updated_at: now
          } satisfies JobRow;
          store.unshift(row);
          return { data: row, error: null };
        }

        if (action === "update") {
          const row = store.find((job) => job.id === idFilter);
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, payload, { updated_at: new Date().toISOString() });
          return { data: row, error: null };
        }

        let rows = [...store];
        const statuses = statusFilter;
        if (statuses) {
          rows = rows.filter((job) => statuses.includes(job.status));
        }
        rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
        return { data: single ? rows[0] ?? null : rows, error: null };
      }

      return builder;
    }
  };
}

const store: JobRow[] = [];
const previousSecret = process.env.GROK_BOT_SECRET;

mock.module("@/lib/supabase/admin", {
  namedExports: {
    createAdminClient() {
      return createFakeJobsClient(store);
    }
  }
});

afterEach(() => {
  store.length = 0;
  if (previousSecret === undefined) {
    delete process.env.GROK_BOT_SECRET;
  } else {
    process.env.GROK_BOT_SECRET = previousSecret;
  }
});

test("valid bearer can list, create, and update jobs while unauthenticated requests cannot", async () => {
  process.env.GROK_BOT_SECRET = "jobs-bot-integration-secret";

  const { GET, POST } = await import("../app/api/jobs/route");
  const { PATCH } = await import("../app/api/jobs/[id]/route");

  const unauthenticated = await GET(new NextRequest("http://localhost/api/jobs"));
  assert.equal(unauthenticated.status, 401);

  const created = await POST(
    new NextRequest("http://localhost/api/jobs", {
      method: "POST",
      headers: {
        authorization: "Bearer jobs-bot-integration-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        category: "technology_improvements",
        details: "Bearer auth integration probe",
        priority: "normal",
        status: "open",
        title: "Bot can create a job"
      })
    })
  );
  assert.equal(created.status, 200);
  const createdJob = (await created.json()) as JobRow;
  assert.equal(createdJob.title, "Bot can create a job");
  assert.equal(createdJob.status, "open");
  assert.equal(createdJob.created_by, null);

  const listed = await GET(
    new NextRequest("http://localhost/api/jobs", {
      headers: { authorization: "Bearer jobs-bot-integration-secret" }
    })
  );
  assert.equal(listed.status, 200);
  const jobs = (await listed.json()) as JobRow[];
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.id, createdJob.id);
  assert.ok(!jobs.some((job) => job.status === "done"));

  const patched = await PATCH(
    new NextRequest(`http://localhost/api/jobs/${createdJob.id}`, {
      method: "PATCH",
      headers: {
        authorization: "Bearer jobs-bot-integration-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({ next_step: "Write the follow-up", status: "in_progress" })
    }),
    { params: Promise.resolve({ id: createdJob.id }) }
  );
  assert.equal(patched.status, 200);
  const updatedJob = (await patched.json()) as JobRow;
  assert.equal(updatedJob.status, "in_progress");
  assert.equal(updatedJob.next_step, "Write the follow-up");
});
