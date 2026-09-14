/**
 * GET   — pack instalado + catálogo.
 * POST  — instala/reaplica (admin). Idempotente.
 * PATCH — liga ou desliga o pack já instalado, sem apagar artefatos.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { catalogoAmigavel } from "@/lib/business-packs/capacidades";
import { catalogoDePacks, resolverPack } from "@/lib/business-packs/catalogo";
import { definirEstadoDoPack } from "@/lib/business-packs/estado";
import { ehBusinessPackId, lerPackGravado } from "@/lib/business-packs/perfil";
import { BUSINESS_PACK_IDS } from "@/lib/business-packs/tipos";
import { carregarConexaoLocadora, urlDaApiDaLocadora } from "@/lib/moope/cliente-locadora";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  pack_id: z.enum(BUSINESS_PACK_IDS),
});

const estadoSchema = z.object({
  action: z.enum(["activate", "deactivate"]),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "business_packs" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings, display_name")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", "Não consegui ler o pack.", 500, { requestId });

  const instalado = lerPackGravado(data?.settings);
  const definition = instalado ? resolverPack(instalado.id) : null;
  const admin = createAdminClient();
  let gestao = false;
  try {
    const conexao = await carregarConexaoLocadora(admin, authz.org.orgId);
    gestao = Boolean(conexao && urlDaApiDaLocadora(conexao));
  } catch {
    gestao = false;
  }

  return ok(
    {
      catalogo: catalogoDePacks(),
      instalado,
      ativo: packEstaAtivo(instalado),
      capacidades: definition ? catalogoAmigavel(definition.capabilities, gestao) : [],
      gestao_configurada: gestao,
      org_name: typeof data?.display_name === "string" ? data.display_name : "sua empresa",
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "business_packs" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Pack inválido.", 422, { requestId });
  if (!ehBusinessPackId(parsed.data.pack_id)) {
    return fail("validation_failed", "Pack inválido.", 422, { requestId });
  }

  try {
    const admin = createAdminClient();
    const r = await aplicarBusinessPack(admin, authz.org.orgId, parsed.data.pack_id, {
      actorUserId: authz.user.id,
    });
    await audit({
      action: r.noop ? "pack.updated" : "pack.installed",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "organization",
      resourceId: authz.org.orgId,
      requestId,
      metadata: { pack_id: parsed.data.pack_id, noop: r.noop },
    });
    return ok({ pack: r.pack, noop: r.noop }, { status: r.noop ? 200 : 201, requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui instalar o pack.",
      500,
      { requestId },
    );
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "business_packs" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = estadoSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Ação inválida.", 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", "Não consegui ler o pack.", 500, { requestId });
  if (!lerPackGravado(data?.settings)) {
    return fail("state_conflict", "Ative o modelo antes de ligar ou desligar.", 409, { requestId });
  }

  try {
    const admin = createAdminClient();
    const ativo = parsed.data.action === "activate";
    const pack = await definirEstadoDoPack(admin, authz.org.orgId, ativo);
    await audit({
      action: ativo ? "pack.enabled" : "pack.disabled",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "organization",
      resourceId: authz.org.orgId,
      requestId,
      metadata: { pack_id: pack.id, status: pack.status },
    });
    return ok({ pack, ativo }, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui mudar o estado do pack.",
      500,
      { requestId },
    );
  }
}
