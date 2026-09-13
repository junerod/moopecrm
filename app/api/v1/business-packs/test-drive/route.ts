/**
 * POST — simula um turno do pack SEM WhatsApp e SEM tool externa.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { recuperarConhecimentoDaEmpresa } from "@/lib/ai/copiloto/recuperar";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { simularTestDrive } from "@/lib/business-packs/test-drive";
import { carregarConexaoLocadora, urlDaApiDaLocadora } from "@/lib/moope/cliente-locadora";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mensagem: z.string().trim().min(2).max(500),
  agent_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "business_packs" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Escreva uma mensagem.", 422, { requestId });

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings, display_name")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  const gravado = lerPackGravado(org?.settings);
  const definition = gravado ? resolverPack(gravado.id) : null;
  if (!definition) {
    return fail("not_found", "Instale um modelo pronto antes de testar.", 404, { requestId });
  }

  const admin = createAdminClient();
  let gestao = false;
  try {
    const conexao = await carregarConexaoLocadora(admin, authz.org.orgId);
    gestao = Boolean(conexao && urlDaApiDaLocadora(conexao));
  } catch {
    gestao = false;
  }

  let hits: Array<{ texto: string; fonte: string }> = [];
  try {
    const rec = await recuperarConhecimentoDaEmpresa(
      supabase,
      authz.org.orgId,
      parsed.data.mensagem,
      parsed.data.agent_id ? { agentId: parsed.data.agent_id } : undefined,
    );
    hits = rec.trechos.slice(0, 3).map((t) => ({
      texto: t.content,
      fonte: t.fonte ?? "conhecimento",
    }));
  } catch {
    hits = [];
  }

  const orgName =
    typeof org?.display_name === "string" && org.display_name.trim()
      ? org.display_name.trim()
      : "sua empresa";

  const resultado = simularTestDrive({
    mensagem: parsed.data.mensagem,
    definition,
    gestaoConfigurada: gestao,
    orgName,
    knowledgeHits: hits,
  });

  return ok(resultado, { requestId });
}
