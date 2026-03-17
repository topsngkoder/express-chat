import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/env/server";

export function createSupabaseAdminClient() {
  return createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

