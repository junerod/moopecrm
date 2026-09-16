"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { IMPERSONATE_COOKIE_NAME } from "@/lib/impersonate/cookie";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hdrs = await headers();
  await supabase.auth.signOut();

  // Clear active_org cookie too.
  const store = await cookies();
  store.delete("active_org");
  // Impersonate preso sobrevive ao logout e no próximo login o dono
  // reabre a empresa do cliente — parece que não saiu.
  store.delete(IMPERSONATE_COOKIE_NAME);

  if (user) {
    await audit({
      action: "auth.logout",
      actorUserId: user.id,
      requestId: hdrs.get("x-request-id"),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: hdrs.get("user-agent") ?? null,
    });
  }

  redirect("/login");
}
