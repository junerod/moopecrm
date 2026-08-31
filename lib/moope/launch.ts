/**
 * Token de launch — 90s, HMAC, sem criar usuário.
 *
 * O parceiro pede um URL; o CRM só abre sessão se o e-mail já for membro.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { caminhoDoLaunchEhSeguro, MOOPE_LAUNCH_TTL_SECONDS } from "@/lib/moope/tipos";

export interface LaunchPayload {
  email: string;
  orgId: string;
  path: string;
  exp: number;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function assinarLaunch(payload: Omit<LaunchPayload, "exp">, secret: string, agora = Date.now()): string {
  const body: LaunchPayload = {
    ...payload,
    path: caminhoDoLaunchEhSeguro(payload.path) ? payload.path : "/app/inbox",
    exp: Math.floor(agora / 1000) + MOOPE_LAUNCH_TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(body), "utf8"));
  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export function verificarLaunch(
  token: string | null,
  secret: string,
  agora = Date.now(),
): LaunchPayload | null {
  if (!token || !secret) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [payloadB64, sigB64] = partes;
  if (!payloadB64 || !sigB64) return null;
  const esperado = createHmac("sha256", secret).update(payloadB64).digest();
  const recebido = b64urlDecode(sigB64);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    return null;
  }
  try {
    const body = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as LaunchPayload;
    if (typeof body.email !== "string" || typeof body.orgId !== "string") return null;
    if (typeof body.exp !== "number" || body.exp < Math.floor(agora / 1000)) return null;
    const path = typeof body.path === "string" && caminhoDoLaunchEhSeguro(body.path)
      ? body.path
      : "/app/inbox";
    return { email: body.email.trim().toLowerCase(), orgId: body.orgId, path, exp: body.exp };
  } catch {
    return null;
  }
}
