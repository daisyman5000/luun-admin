import "server-only";
import { getSupabaseUrl } from "@/lib/supabase/public-config";

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getSupabaseServerConfig() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    throw new Error("Missing Supabase server configuration");
  }

  return { secretKey, url };
}
