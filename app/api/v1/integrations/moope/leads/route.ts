/**
 * GET /api/v1/integrations/moope/leads
 *
 * Últimos negócios. Só leitura: não move, não ganha, não perde.
 * Agente vê os seus. Gestor vê os do escritório.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { leadsDoParceiro } from "@/lib/moope/leitura-consultar";
import { abrirLeitura, ler } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["open", "won", "lost", "all"]).default("all"),
  contact_external_id: z.string().trim().min(1).max(200).optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;

  const parsed = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    contact_external_id: req.nextUrl.searchParams.get("contact_external_id") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Consulta de leads inválida.", 422, {
      requestId: aberto.requestId,
    });
  }

  return ler(
    aberto,
    () =>
      leadsDoParceiro(aberto.admin, aberto.orgId, aberto.ator, {
        limite: parsed.data.limit,
        status: parsed.data.status,
        contactExternalId: parsed.data.contact_external_id ?? null,
      }),
    { limit: parsed.data.limit, status: parsed.data.status },
  );
}
