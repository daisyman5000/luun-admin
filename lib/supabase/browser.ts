"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export function createClient() {
  const { publishableKey, url } = getSupabasePublicConfig();

  return createBrowserClient(url, publishableKey);
}
