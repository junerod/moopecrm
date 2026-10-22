/**
 * GET /api/v1/integrations/moope/agenda
 *
 * Compromissos do período. Só leitura. Chave mop_ + actor_email.
 * Sem de/ate, devolve hoje e amanhã em America/Sao_Paulo.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { compromissosDoParceiro } from "@/lib/moope/leitura-consultar";
import { abrirLeitura, ler } from "@/lib/moope/leitura-porta";
import { janelaPadraoDaAgenda, validarJanela } from "@/lib/moope/leitura";

export const dynamic = "force-dynamic";

const instante = z.string().datetime({ offset: true });

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;

  const deBruto = req.nextUrl.searchParams.get("de");
  const ateBruto = req.nextUrl.searchParams.get("ate");
  let de: string;
  let ate: string;
  if (!deBruto && !ateBruto) {
    const padrao = janelaPadraoDaAgenda();
    de = padrao.de;
    ate = padrao.ate;
  } else {
    const parsed = z.object({ de: instante, ate: instante }).safeParse({ de: deBruto, ate: ateBruto });
    if (!parsed.success) {
      return fail("validation_failed", "Informe de e ate juntos, em ISO-8601 com fuso.", 422, {
        requestId: aberto.requestId,
      });
    }
    const janela = validarJanela(parsed.data.de, parsed.data.ate);
    if (!janela.ok) {
      return fail("validation_failed", janela.message, 422, { requestId: aberto.requestId });
    }
    de = parsed.data.de;
    ate = parsed.data.ate;
  }

  return ler(
    aberto,
    () => compromissosDoParceiro(aberto.admin, aberto.orgId, aberto.ator, de, ate),
    { de, ate },
  );
}
