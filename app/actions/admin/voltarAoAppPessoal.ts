"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { escolherOrgAtiva } from "@/lib/auth/org-ativa";
import { requireAuth } from "@/lib/auth/server";
import { destinoDoAppPessoal } from "@/lib/auth/saida-da-plataforma";
import { IMPERSONATE_COOKIE_NAME } from "@/lib/impersonate/cookie";

/**
 * Sai do modo plataforma (e de um impersonate preso) e abre o CRM da
 * empresa desta pessoa. Sem empresa, não devolve ao dashboard — isso
 * era o laço.
 */
export async function voltarAoAppPessoal(): Promise<void> {
  const user = await requireAuth();
  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE_NAME);
  const org = escolherOrgAtiva({
    memberships: user.organizations,
    cookieOrg: store.get("active_org")?.value,
  });
  redirect(destinoDoAppPessoal(Boolean(org)));
}
