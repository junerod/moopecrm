/**
 * POST /api/v1/integrations/moope/ia-credencial
 *
 * A locadora manda a chave de IA (Bearer mop_). Grava na org via o mesmo
 * caminho da tela de credenciais. Sem cookie. A chave não volta na resposta.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { guardarCredencial } from "@/lib/ai/credenciais/guardar";
import type { Provider } from "@/lib/ai/provider-validators";
import { IDS_DE_PROVEDOR } from "@/lib/ai/pontos/provedores";
import { emailEMembro, resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { garantirAgenteAtendimentoLocadora } from "@/lib/moope/agente-atendimento-locadora";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  api_key: z.string().trim().min(8).max(2048),
  provider: z.enum(IDS_DE_PROVEDOR).optional(),
  owner_email: z.string().email().optional(),
});

function inferirProvedor(raw: string): Provider {
  const k = raw.trim();
  if (k.startsWith("sk-ant")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("AIza")) return "google";
  return "openai";
}

async function userDaOrg(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  email?: string,
): Promise<string | null> {
  if (email) {
    const m = await emailEMembro(admin, orgId, email);
    if (m) return m.userId;
  }
  const { data } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", orgId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }
  if (conexao.kind !== "locadora") {
    return fail("forbidden", "Só a locadora envia chave de IA por este caminho.", 403, { requestId });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const provider = (body.provider || inferirProvedor(body.api_key)) as Provider;
  const userId = await userDaOrg(admin, conexao.organization_id, body.owner_email);
  if (!userId) {
    return fail("not_found", "Não achei o dono desta organização no CRM.", 404, { requestId });
  }

  let last4: string | null = null;
  const guardado = await guardarCredencial({
    admin,
    orgId: conexao.organization_id,
    userId,
    provider,
    label: "MOOPE locadora",
    apiKey: body.api_key,
    requestId,
  });
  if (guardado.ok) {
    last4 = guardado.last4;
  } else if (guardado.motivo === "label_em_uso") {
    const { data: ja } = await admin
      .from("ai_provider_credentials_safe")
      .select("api_key_last4")
      .eq("organization_id", conexao.organization_id)
      .eq("provider", provider)
      .eq("label", "MOOPE locadora")
      .maybeSingle();
    last4 = (ja as { api_key_last4?: string } | null)?.api_key_last4 ?? null;
  } else {
    return fail("internal_error", "Não gravei a chave de IA.", 500, { requestId });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", conexao.organization_id)
    .maybeSingle();
  const settings =
    org?.settings && typeof org.settings === "object" ? (org.settings as Record<string, unknown>) : {};
  const llm = settings.llm && typeof settings.llm === "object" ? (settings.llm as Record<string, unknown>) : {};
  await admin
    .from("organizations")
    .update({ settings: { ...settings, llm: { ...llm, provider } } } as never)
    .eq("id", conexao.organization_id);

  const agente = await garantirAgenteAtendimentoLocadora(admin, conexao.organization_id, userId);

  await audit({
    action: "moope.ai_credential_from_locadora",
    actorUserId: userId,
    organizationId: conexao.organization_id,
    resourceType: "ai_provider_credential",
    resourceId: guardado.ok ? guardado.id : "existente",
    requestId,
    metadata: { provider, last4: guardado.last4 },
  });

  return ok(
    {
      provider,
      last4,
      agente: { ok: agente.ok, status: agente.status, origem: agente.origem, motivo: agente.motivo },
    },
    { status: 201, requestId },
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }
  if (conexao.kind !== "locadora") {
    return fail("forbidden", "Só a locadora consulta por este caminho.", 403, { requestId });
  }

  const { data: creds } = await admin
    .from("ai_provider_credentials_safe")
    .select("api_key_last4, label")
    .eq("organization_id", conexao.organization_id)
    .limit(8);
  const lista = (creds ?? []) as { api_key_last4?: string; label?: string }[];
  const preferida =
    lista.find((c) => c.label === "MOOPE locadora") || lista.find((c) => c.api_key_last4) || null;
  const last4 = preferida?.api_key_last4 ? String(preferida.api_key_last4).slice(-4) : "";

  const { data: porNome } = await admin
    .from("ai_agents")
    .select("id, published_version_id")
    .eq("organization_id", conexao.organization_id)
    .eq("name", "Atendimento locadora")
    .is("archived_at", null)
    .maybeSingle();
  const published = Boolean(
    (porNome as { published_version_id?: string | null } | null)?.published_version_id,
  );

  return ok(
    {
      last4: last4 || null,
      has_key: Boolean(last4),
      atendimento_ok: Boolean(porNome),
      agente: porNome
        ? { ok: true, status: published ? "published" : "draft", origem: "existente" }
        : null,
    },
    { status: 200, requestId },
  );
}
