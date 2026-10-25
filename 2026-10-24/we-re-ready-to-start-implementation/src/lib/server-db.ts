import { createClient } from "@supabase/supabase-js";
export function serverDb(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = token ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server database configuration is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}) });
}
