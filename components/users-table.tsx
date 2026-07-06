"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";
import type { Profile, UserRole } from "@/lib/types";

const roles: UserRole[] = ["owner", "admin", "logistics", "viewer"];

export function UsersTable({
  initialProfiles,
  canManage
}: {
  initialProfiles: Profile[];
  canManage: boolean;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [message, setMessage] = useState<string | null>(null);

  async function updateRole(profile: Profile, role: UserRole) {
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profile.id)
      .select()
      .single<Profile>();

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((currentProfiles) =>
      currentProfiles.map((currentProfile) =>
        currentProfile.id === profile.id ? data : currentProfile
      )
    );
    setMessage("User role updated.");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {canManage ? "Owner and admin users can change roles." : "Your role can view users only."}
        </p>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            <tr>
              <th className="border-b border-line px-3 py-3 font-semibold">Name</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Email</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Role</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr className="border-b border-line last:border-0" key={profile.id}>
                <td className="px-3 py-3 font-medium">{profile.full_name}</td>
                <td className="px-3 py-3 text-slate-600">{profile.email}</td>
                <td className="px-3 py-3">
                  <select
                    className="rounded-md border border-line bg-white px-2 py-1.5 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                    disabled={!canManage}
                    onChange={(event) => updateRole(profile, event.target.value as UserRole)}
                    value={profile.role}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatDate(profile.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
