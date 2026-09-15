// app/api/v1/messages/[id]/media/route.ts
/**
 * GET /api/v1/messages/[id]/media — bytes autenticados da mídia.
 * Sempre 200 com o binário (same-origin). 302 para signed URL quebrava
 * <audio>/<video>: o browser ia para outra origem e o player mostrava
 * "Mídia indisponível".
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { servirBytesDaMidia } from "@/lib/messaging/media/servir";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: messageId } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }
  const authUser = await loadAuthUser();
  const activeOrg = authUser ? await resolveActiveOrg(authUser) : null;
  if (!activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }

  const { data: msg, error } = await supabase
    .from("messages")
    .select("id, organization_id, media_url, media_mime, media_storage_path")
    .eq("id", messageId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (error) {
    return fail("internal_error", "Erro ao buscar mensagem.", 500, { requestId });
  }
  if (!msg) {
    return fail("not_found", "Mensagem sem mídia.", 404, { requestId });
  }

  const midia = await servirBytesDaMidia({
    id: msg.id,
    organization_id: activeOrg.orgId,
    media_url: msg.media_url,
    media_mime: msg.media_mime,
    media_storage_path: msg.media_storage_path,
  });
  if (!midia) {
    return fail("not_found", "Mensagem sem mídia.", 404, { requestId });
  }

  return new Response(new Uint8Array(midia.buffer), {
    status: 200,
    headers: {
      "Content-Type": midia.mime,
      "Cache-Control": "private, max-age=60",
      "X-Request-Id": requestId,
    },
  });
}
