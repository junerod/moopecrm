/**
 * Anexos de campanha — referência no Storage, nunca base64 no banco.
 * Tipos e tetos centralizados. Mais estreitos que o inbox (50 MB).
 */
export const MIMES_CAMPANHA = {
  image: ["image/jpeg", "image/png", "image/webp"] as const,
  video: ["video/mp4"] as const,
  audio: ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/webm", "audio/aac"] as const,
  document: ["application/pdf"] as const,
};

export const TETO_CAMPANHA_BYTES = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 10 * 1024 * 1024,
} as const;

export const MAX_ANEXOS_CAMPANHA = 3;

export type KindDeMidiaCampanha = "image" | "video" | "audio" | "document";

export type VereditoDeMidiaCampanha =
  | { ok: true; kind: KindDeMidiaCampanha }
  | {
      ok: false;
      code: "unsupported_media_type" | "payload_too_large" | "validation_failed";
      message: string;
    };

export function kindDeMimeCampanha(mime: string): KindDeMidiaCampanha | null {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  if ((MIMES_CAMPANHA.image as readonly string[]).includes(base)) return "image";
  if ((MIMES_CAMPANHA.video as readonly string[]).includes(base)) return "video";
  if ((MIMES_CAMPANHA.audio as readonly string[]).includes(base)) return "audio";
  if ((MIMES_CAMPANHA.document as readonly string[]).includes(base)) return "document";
  return null;
}

export function validarMidiaDaCampanha(mime: string, sizeBytes: number): VereditoDeMidiaCampanha {
  if (!sizeBytes || sizeBytes <= 0) {
    return { ok: false, code: "validation_failed", message: "Arquivo vazio." };
  }
  const kind = kindDeMimeCampanha(mime);
  if (!kind) {
    return {
      ok: false,
      code: "unsupported_media_type",
      message: "Use JPEG, PNG, WebP, MP4, áudio (OGG, MP3, M4A, WEBM, AAC) ou PDF.",
    };
  }
  if (sizeBytes > TETO_CAMPANHA_BYTES[kind]) {
    const mb = Math.round(TETO_CAMPANHA_BYTES[kind] / (1024 * 1024));
    return {
      ok: false,
      code: "payload_too_large",
      message: `Arquivo acima de ${mb} MB para este tipo.`,
    };
  }
  return { ok: true, kind };
}

export function caminhoDeMidiaCampanha(
  organizationId: string,
  campaignId: string,
  filename: string,
): string {
  const limpo = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${organizationId}/campaigns/${campaignId}/${Date.now()}-${limpo}`;
}

export function midiaCompativelComCanal(
  kind: KindDeMidiaCampanha,
  canal: "whatsapp" | "email",
  caps?: { supportsImage?: boolean; supportsVideo?: boolean; supportsDocument?: boolean },
): boolean {
  if (canal === "email") return true;
  if (!caps) return true;
  if (kind === "image") return caps.supportsImage !== false;
  if (kind === "video") return caps.supportsVideo !== false;
  if (kind === "audio") return true;
  return caps.supportsDocument !== false;
}

/** O arquivo da campanha mora sob a org. Path de outra org não é assinado. */
export function pathDeMidiaDaOrg(storagePath: string, organizationId: string): boolean {
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) return false;
  return storagePath.startsWith(`${organizationId}/`);
}
