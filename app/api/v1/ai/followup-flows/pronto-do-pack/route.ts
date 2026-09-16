/**
 * POST /api/v1/ai/followup-flows/pronto-do-pack — liga, ajusta ou desliga
 * um fluxo pronto do Pack ativo. Body: { key, mensagem?, ativo? }.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  ativarFluxoDoPack,
  ajusteFluxoDoPackSchema,
} from "@/lib/negocio/fluxos-do-pack";
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

  const parsed = ajusteFluxoDoPackSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Informe o fluxo e, se for o caso, a mensagem.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const r = await ativarFluxoDoPack(
      createAdminClient(),
      authz.org.orgId,
      authz.user.id,
      parsed.data,
    );
    void audit({
      action: r.ativo ? "followup_flow.published" : "followup_flow.disabled",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "followup_flow_pointer",
      resourceId: r.id,
      requestId,
      metadata: {
        pronto: "pack",
        key: r.key,
        ativo: r.ativo,
        mensagem_chars: r.mensagem.length,
      },
    });
    return ok(
      {
        id: r.id,
        key: r.key,
        ativo: r.ativo,
        mensagem: r.mensagem,
      },
      { requestId },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não consegui gravar o fluxo.";
    const status = /ative um modelo|não existe|não encontrado|ainda não/i.test(msg) ? 422 : 500;
    return fail(status === 422 ? "validation_failed" : "internal_error", msg, status, { requestId });
  }
}
