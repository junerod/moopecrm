/**
 * POST /api/v1/campanhas/midia — upload de anexo da campanha.
 * Guarda path no Storage. Nunca base64 no banco.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { caminhoDeMidiaCampanha, validarMidiaDaCampanha } from "@/lib/campanhas/midia";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > 20 * 1024 * 1024) {
    return fail("payload_too_large", "Arquivo acima do limite da campanha.", 413, { requestId });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const campaignId = String(form?.get("campaign_id") ?? "draft");
  if (!(file instanceof File)) {
    return fail("validation_failed", "Campo 'file' obrigatório.", 422, { requestId });
  }

  const mime = file.type || "application/octet-stream";
  const veredito = validarMidiaDaCampanha(mime, file.size);
  if (!veredito.ok) {
    const status = veredito.code === "payload_too_large" ? 413 : 415;
    return fail(veredito.code, veredito.message, status, { requestId });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = caminhoDeMidiaCampanha(authz.org.orgId, campaignId, file.name);
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("whatsapp-media")
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (error) {
    return fail("internal_error", "Erro ao subir o arquivo.", 500, { requestId });
  }

  const { data: assinada } = await admin.storage
    .from("whatsapp-media")
    .createSignedUrl(storagePath, 60 * 60);

  return ok(
    {
      storage_path: storagePath,
      mime,
      size_bytes: buffer.length,
      filename: file.name,
      kind: veredito.kind,
      preview_url: assinada?.signedUrl ?? null,
    },
    { requestId },
  );
}
