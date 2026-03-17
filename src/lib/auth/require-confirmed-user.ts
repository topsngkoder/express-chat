import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConfirmedUser = {
  id: string;
  email: string;
};

export async function requireConfirmedUser(): Promise<ConfirmedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    redirect("/login");
  }

  if (!user.email_confirmed_at) {
    redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  }

  return {
    id: user.id,
    email: user.email,
  };
}
