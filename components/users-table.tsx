"use client";

import { useState } from "react";
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
    const response = await fetch(`/api/profiles/${profile.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error || "Unable to update user role.");
      return;
    }

    const data = (await response.json()) as Profile;
    setProfiles((currentProfiles) =>
      currentProfiles.map((currentProfile) =>
        currentProfile.id === profile.id ? data : currentProfile
      )
    );
    setMessage("User role updated.");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {canManage ? "Owner and admin users can change roles." : "Your role can view users only."}
        </p>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
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
                    className="min-w-40 rounded-md border border-line bg-white px-4 py-3 disabled:border-line disabled:bg-slate-50"
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
