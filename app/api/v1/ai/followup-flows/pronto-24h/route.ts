/**
 * POST /api/v1/ai/followup-flows/pronto-24h — liga ou ajusta o lembrete de silêncio.
 *
 * Body opcional: { mensagem?, horas? }. Sem body, liga com a semente
 * (ou não mexe se já estiver ativo). AI_MODE OFF não impede: o envio é
 * determinístico.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  ativarFollowup24h,
  ajusteFollowup24hSchema,
} from "@/lib/negocio/followup-24h";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "followup_flows" });
  if (!authz.ok) return authz.response;

  let raw: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
    }
  }

  const parsed = ajusteFollowup24hSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Escreva a mensagem e um tempo entre 1 e 168 horas.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const r = await ativarFollowup24h(
      createAdminClient(),
      authz.org.orgId,
      authz.user.id,
      parsed.data,
    );
    void audit({
      action: "followup_flow.published",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "followup_flow_pointer",
      resourceId: r.id,
      requestId,
      metadata: {
        pronto: "silencio-24h",
        ja_estava_ativo: r.jaEstavaAtivo,
        horas: r.minutos / 60,
        mensagem_chars: r.mensagem.length,
      },
    });
    return ok(
      {
        id: r.id,
        ja_estava_ativo: r.jaEstavaAtivo,
        mensagem: r.mensagem,
        horas: r.minutos / 60,
      },
      { requestId },
    );
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui gravar o lembrete.",
      500,
      { requestId },
    );
  }
}
