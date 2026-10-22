/**
 * Resposta das rotas do quadro. A rota só abre a porta e chama o consultar.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import type { LeituraAberta } from "@/lib/moope/leitura-porta";
import type { FalhaDoQuadro } from "@/lib/moope/funil-quadro-consultar";

const uuid = z.string().uuid();

export function idsDoQuadro(
  params: { id?: string; leadId?: string },
  requestId: string,
): { pipelineId: string; leadId: string | null } | Response {
  const funil = uuid.safeParse(params.id);
  if (!funil.success) {
    return fail("validation_failed", "Funil inválido.", 422, { requestId });
  }
  if (params.leadId === undefined) {
    return { pipelineId: funil.data, leadId: null };
  }
  const card = uuid.safeParse(params.leadId);
  if (!card.success) {
    return fail("validation_failed", "Negócio inválido.", 422, { requestId });
  }
  return { pipelineId: funil.data, leadId: card.data };
}

export function ehResposta(valor: unknown): valor is Response {
  return valor instanceof Response;
}

export async function entregar(
  aberto: LeituraAberta,
  resultado: unknown,
  leitura: boolean,
): Promise<Response> {
  if (ehFalha(resultado)) {
    return fail(resultado.code, resultado.message, resultado.status, {
      requestId: aberto.requestId,
      details: resultado.details,
    });
  }
  const corpo =
    resultado &&
    typeof resultado === "object" &&
    (resultado as { ok?: boolean }).ok === true &&
    "data" in resultado
      ? (resultado as { data: unknown }).data
      : resultado;
  return ok(corpo, {
    requestId: aberto.requestId,
    meta: { read_only: leitura, scope: "office" },
  });
}

export async function executar(
  aberto: LeituraAberta,
  fn: () => Promise<unknown>,
  leitura: boolean,
): Promise<Response> {
  try {
    return await entregar(aberto, await fn(), leitura);
  } catch (err) {
    logger.warn("moope.funil", { erro: err instanceof Error ? err.message : "falha" });
    return fail(
      "internal_error",
      leitura ? "Não consegui ler o funil agora." : "Não consegui mexer no funil agora.",
      500,
      { requestId: aberto.requestId },
    );
  }
}

function ehFalha(valor: unknown): valor is FalhaDoQuadro {
  return Boolean(
    valor &&
      typeof valor === "object" &&
      (valor as FalhaDoQuadro).ok === false &&
      typeof (valor as FalhaDoQuadro).status === "number",
  );
}
