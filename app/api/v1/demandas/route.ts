/**
 * POST /api/v1/demandas — cria ou edita o próximo passo comercial do contato.
 *
 * PATCH /demandas/{id} continua sendo o caminho quando a ficha já tem o id.
 * Este POST existe para conversa histórica SEM demanda aberta: mesma tabela,
 * mesma coluna, sem task nova.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { definirProximoPassoComercial } from "@/lib/demandas/definir-proximo-passo";
import { listarProximasAcoes, type VisaoDaAcao } from "@/lib/demandas/listar-proximas-acoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contact_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  proximo_passo: z.string().trim().min(3).max(500),
  proximo_passo_em: z.string().datetime({ offset: true }).nullish(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "demandas" });
  if (!authz.ok) return authz.response;

  const visaoRaw = req.nextUrl.searchParams.get("visao") ?? "todas";
  const visoes: VisaoDaAcao[] = ["hoje", "proximos", "atrasados", "sem_passo", "todas"];
  const visao = visoes.includes(visaoRaw as VisaoDaAcao) ? (visaoRaw as VisaoDaAcao) : "todas";
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  const ownerRaw = req.nextUrl.searchParams.get("owner");
  const owner =
    ownerRaw && /^[0-9a-f-]{36}$/i.test(ownerRaw) ? ownerRaw : undefined;

  const supabase = await createClient();
  try {
    const data = await listarProximasAcoes(supabase, {
      organizationId: authz.org.orgId,
      visao,
      ownerUserId: mine ? authz.user.id : owner,
    });
    return ok(data, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao listar próximas ações.",
      500,
      { requestId },
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "demandas" });
  if (!authz.ok) return authz.response;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = bodySchema.safeParse(corpo);
  if (!parsed.success) {
    return fail(
      "validation_failed",
      "O próximo passo precisa ter de 3 a 500 caracteres.",
      422,
      { details: parsed.error.flatten().fieldErrors as Record<string, unknown>, requestId },
    );
  }

  const admin = createAdminClient();
  const { data: contato, error: erroContato } = await admin
    .from("contacts")
    .select("id")
    .eq("id", parsed.data.contact_id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (erroContato) return fail("internal_error", erroContato.message, 500, { requestId });
  if (!contato) return fail("not_found", "Contato não encontrado.", 404, { requestId });

  try {
    const gravado = await definirProximoPassoComercial(admin, {
      organizationId: authz.org.orgId,
      contactId: parsed.data.contact_id,
      conversationId: parsed.data.conversation_id,
      userId: authz.user.id,
      proximo_passo: parsed.data.proximo_passo,
      proximo_passo_em: parsed.data.proximo_passo_em ?? null,
      leadId: parsed.data.lead_id,
    });

    void audit({
      action: "demanda.proximo_passo_definido",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "demanda",
      resourceId: gravado.demanda_id,
      requestId,
      metadata: {
        proximo_passo: gravado.proximo_passo,
        proximo_passo_em: gravado.proximo_passo_em,
      },
    });

    return ok(gravado, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao gravar o próximo passo.",
      500,
      { requestId },
    );
  }
}
