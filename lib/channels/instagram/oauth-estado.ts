/**
 * `state` do consentimento da Meta — o mesmo contrato do Google:
 * HMAC, prazo curto, org + quem clicou. Sem isto o retorno não sabe
 * em qual tenant gravar a conta.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const VALIDADE_DO_ESTADO_MS = 10 * 60 * 1000;
const TAMANHO_MINIMO_DO_SEGREDO = 16;

export interface EstadoDaConexaoInstagram {
  organizationId: string;
  userId: string;
  nonce: string;
  expiraEmMs: number;
}

function assinar(carga: string, segredo: string): Buffer {
  return createHmac("sha256", segredo).update(carga, "utf8").digest();
}

function conferirSegredo(segredo: string): string {
  const s = segredo?.trim() ?? "";
  if (s.length < TAMANHO_MINIMO_DO_SEGREDO) {
    throw new Error("INTERNAL_SECRET ausente ou curto demais");
  }
  return s;
}

export function emitirEstadoInstagram(
  dados: { organizationId: string; userId: string },
  opcoes: { segredo: string; agora: Date; nonce?: string; validadeMs?: number },
): string {
  const segredo = conferirSegredo(opcoes.segredo);
  const organizationId = dados.organizationId?.trim() ?? "";
  const userId = dados.userId?.trim() ?? "";
  if (!organizationId || !userId) {
    throw new Error("state precisa de organizationId e userId");
  }
  if (organizationId.includes(".") || userId.includes(".")) {
    throw new Error("organizationId/userId com ponto");
  }
  const nonce = opcoes.nonce?.trim() || randomBytes(16).toString("hex");
  const expira = opcoes.agora.getTime() + (opcoes.validadeMs ?? VALIDADE_DO_ESTADO_MS);
  const carga = `${organizationId}.${userId}.${nonce}.${expira}`;
  const assinatura = assinar(carga, segredo).toString("hex");
  return `${Buffer.from(carga, "utf8").toString("base64url")}.${assinatura}`;
}

export function verificarEstadoInstagram(
  token: string | null | undefined,
  opcoes: { segredo: string; agora: Date },
): EstadoDaConexaoInstagram | null {
  if (!token) return null;
  const segredo = conferirSegredo(opcoes.segredo);
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [cargaCodificada, assinaturaHex] = partes;
  if (!cargaCodificada || !assinaturaHex) return null;
  let carga: string;
  try {
    carga = Buffer.from(cargaCodificada, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const esperada = assinar(carga, segredo);
  const recebida = Buffer.from(assinaturaHex, "hex");
  if (recebida.length !== esperada.length) return null;
  if (!timingSafeEqual(recebida, esperada)) return null;
  const campos = carga.split(".");
  if (campos.length !== 4) return null;
  const [organizationId, userId, nonce, expiraTexto] = campos;
  const expiraEmMs = Number(expiraTexto);
  if (!organizationId || !userId || !nonce || !Number.isFinite(expiraEmMs)) return null;
  if (opcoes.agora.getTime() > expiraEmMs) return null;
  return { organizationId, userId, nonce, expiraEmMs };
}
