/**
 * GET  — lista coleções da organização (settings.knowledge_collections).
 * POST — cria coleção. Sem tabela nova.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { COLECOES_PADRAO, lerColecoesDoSettings, slugify } from "@/lib/ai/knowledge/colecoes";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", "Não consegui ler as coleções.", 500, { requestId });

  let colecoes = lerColecoesDoSettings(data?.settings);
  if (colecoes.length === 0) {
    colecoes = await semearPadrao(authz.org.orgId);
  }
  return ok({ colecoes }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Nome inválido.", 422, { requestId });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error || !data) return fail("internal_error", "Organização não encontrada.", 500, { requestId });

  const atuais = lerColecoesDoSettings(data.settings);
  const nova = {
    id: randomUUID(),
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
  };
  const settings = {
    ...((data.settings ?? {}) as Record<string, unknown>),
    knowledge_collections: [...atuais, nova],
  };
  const { error: up } = await admin
    .from("organizations")
    .update({ settings })
    .eq("id", authz.org.orgId);
  if (up) return fail("internal_error", "Não consegui criar a coleção.", 500, { requestId });
  return ok({ colecao: nova }, { status: 201, requestId });
}

async function semearPadrao(orgId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const atuais = lerColecoesDoSettings(data?.settings);
  if (atuais.length > 0) return atuais;
  const semeadas = COLECOES_PADRAO.map((c) => ({ id: randomUUID(), name: c.name, slug: c.slug }));
  const settings = {
    ...((data?.settings ?? {}) as Record<string, unknown>),
    knowledge_collections: semeadas,
  };
  await admin.from("organizations").update({ settings }).eq("id", orgId);
  return semeadas;
}
