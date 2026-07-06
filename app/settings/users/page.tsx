import { SetupError } from "@/components/setup-error";
import { UsersTable } from "@/components/users-table";
import { SupabaseDiagnostics } from "@/components/supabase-diagnostics";
import { canManageUsers, requireUser } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const { supabase, profile } = await requireUser();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Users</h1>
        <p className="mt-1 text-sm text-slate-600">Manage internal access roles.</p>
      </div>
      <SupabaseDiagnostics />
      {error ? (
        <SetupError message={error.message} title="Users database issue" />
      ) : (
        <UsersTable canManage={canManageUsers(profile?.role)} initialProfiles={profiles || []} />
      )}
    </main>
  );
}
