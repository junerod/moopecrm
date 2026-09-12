/**
 * GET /api/v1/contacts/:id/moope-retrato
 *
 * Leitura contextual da Gestão. Fail-closed: nunca 500 quebra o cockpit.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { getRetratoLocatario } from "@/lib/moope/cliente-locadora";
import {
  locatarioIdDoContato,
  mensagemDaFalha,
  projetarRetratoComercial,
  retratoDoCache,
} from "@/lib/moope/retrato-comercial";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: contato } = await supabase
    .from("contacts")
    .select("id, source, source_metadata")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", "Contato não encontrado.", 404, { requestId });

  const meta = ((contato as { source_metadata?: Record<string, unknown> }).source_metadata ??
    {}) as Record<string, unknown>;
  const locatarioId = locatarioIdDoContato({
    source: (contato as { source?: string }).source,
    source_metadata: meta,
  });
  const cache = retratoDoCache(meta);

  if (!locatarioId && !cache) {
    return ok(
      { disponivel: false, motivo: "sem_vinculo_moope" },
      { requestId },
    );
  }

  if (locatarioId) {
    try {
      const vivo = await getRetratoLocatario(
        createAdminClient(),
        authz.org.orgId,
        locatarioId,
        { timeoutMs: cache ? 1_500 : 4_000 },
      );
      if (vivo.ok) {
        return ok(
          { disponivel: true, fonte: "live", retrato: projetarRetratoComercial(vivo) },
          { requestId },
        );
      }
      if (cache) {
        return ok(
          { disponivel: true, fonte: "cache", retrato: projetarRetratoComercial(cache) },
          { requestId },
        );
      }
      return ok(
        { disponivel: false, motivo: vivo.codigo, mensagem: mensagemDaFalha(vivo) },
        { requestId },
      );
    } catch {
      if (cache) {
        return ok(
          { disponivel: true, fonte: "cache", retrato: projetarRetratoComercial(cache) },
          { requestId },
        );
      }
      return ok(
        {
          disponivel: false,
          motivo: "indisponivel",
          mensagem: "Não consegui consultar agora.",
        },
        { requestId },
      );
    }
  }

  return ok(
    { disponivel: true, fonte: "cache", retrato: projetarRetratoComercial(cache!) },
    { requestId },
  );
}
