import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/server-config";

export function createAdminClient() {
  const { secretKey, url } = getSupabaseServerConfig();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
