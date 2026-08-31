/**
 * Chave de entrada e segredo de saída da conexão MOOPE.
 *
 * Entrada: plaintext uma vez, hash SHA256 no banco — o molde das api_tokens.
 * Saída: o CRM precisa assinar HMAC, então o segredo fica cifrado, não hashed.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PREFIXO_CHAVE_ENTRADA = "mop_";

export function hashDaChave(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function gerarChaveDeEntrada(): { plaintext: string; prefix: string; hash: string } {
  const prefix = `${PREFIXO_CHAVE_ENTRADA}${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${prefix}_${secret}`;
  return { plaintext, prefix, hash: hashDaChave(plaintext) };
}

export function gerarSegredoDeSaida(): string {
  return randomBytes(32).toString("base64url");
}

export function chaveBate(plaintext: string, hashEsperado: string): boolean {
  const obtido = Buffer.from(hashDaChave(plaintext), "hex");
  const esperado = Buffer.from(hashEsperado, "hex");
  if (obtido.length !== esperado.length || obtido.length === 0) return false;
  return timingSafeEqual(obtido, esperado);
}

export function extrairBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1]!.trim() : null;
}
