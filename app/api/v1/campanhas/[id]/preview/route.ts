import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body_text: z.string().max(2000).optional(),
  nome: z.string().max(80).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().max(120).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  let corpo: unknown = {};
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }
  const parsed = bodySchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Preview inválido.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("body_text")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!data) return fail("not_found", "Campanha não encontrada.", 404, { requestId });

  const template = parsed.data.body_text ?? (data as { body_text: string }).body_text;
  const preview = previewDaCampanha({
    template,
    valores: {
      nome: parsed.data.nome ?? "Maria",
      telefone: parsed.data.telefone ?? "+5511999990000",
      email: parsed.data.email ?? "maria@exemplo.com",
    },
  });
  return ok(preview, { requestId });
}
