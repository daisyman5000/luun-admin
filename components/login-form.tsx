"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { hasSupabasePublicConfig } from "@/lib/supabase/public-config";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isConfigured = hasSupabasePublicConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError("Supabase is not configured in Vercel.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace(searchParams.get("redirectedFrom") || "/data");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-md border border-line bg-white px-4 py-3 text-base outline-none ring-0"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-white px-4 py-3 text-base outline-none ring-0"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      {!isConfigured ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Supabase is not configured in Vercel.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="w-full rounded-md bg-ink px-5 py-3 text-base font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || !isConfigured}
        type="submit"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
