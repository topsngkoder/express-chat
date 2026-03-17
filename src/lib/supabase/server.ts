import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/env/public";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll?.() ?? [];
        },
        setAll(cookiesToSet) {
          // Вызовы set возможны только в server actions / route handlers.
          // Если хелпер используется в server component, Next может запретить запись cookies.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set?.(name, value, options));
          } catch {
            // noop
          }
        },
      },
    },
  );
}

