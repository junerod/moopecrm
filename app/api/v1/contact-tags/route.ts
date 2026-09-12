/**
 * GET /api/v1/contact-tags — tags já usadas nos contatos da org.
 * Sugestões reutilizáveis no Inbox (plataforma, rastreamento, …).
 * Leitura autenticada no servidor: o cookie é HttpOnly.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { vocabularioDeTagsDeContato } from "@/lib/inbox/vocabulario-de-tags";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  try {
    const tags = await vocabularioDeTagsDeContato(supabase, activeOrg.orgId);
    return ok(tags, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao ler tags.";
    return fail("internal_error", message, 500, { requestId });
  }
}
