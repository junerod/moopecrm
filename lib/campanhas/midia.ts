/**
 * Anexos de campanha — referência no Storage, nunca base64 no banco.
 * Tipos e tetos centralizados. Mais estreitos que o inbox (50 MB).
 */
export const MIMES_CAMPANHA = {
  image: ["image/jpeg", "image/png", "image/webp"] as const,
  video: ["video/mp4"] as const,
  document: ["application/pdf"] as const,
};

export const TETO_CAMPANHA_BYTES = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 10 * 1024 * 1024,
} as const;

export const MAX_ANEXOS_CAMPANHA = 3;

export type KindDeMidiaCampanha = "image" | "video" | "document";

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
      message: "Use JPEG, PNG, WebP, MP4 ou PDF.",
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
  return caps.supportsDocument !== false;
}
