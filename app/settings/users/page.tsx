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
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-normal">Users</h1>
        <p className="mt-2 text-base text-slate-600">Manage internal access roles.</p>
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
