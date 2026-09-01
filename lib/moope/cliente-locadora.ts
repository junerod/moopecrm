/**
 * O CRM chama a locadora — leitura, nunca mutação.
 *
 * Credencial = o segredo de saída da conexão leva 1 (HMAC), não JWT humano
 * e não `mop_` na query. A locadora ainda não tem estas rotas nesta sessão;
 * o cliente falha fechado (404/401/5xx/timeout) e o inbox não quebra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptWebhookSecret } from "@/lib/webhooks/secrets";
import { assinarSaida } from "@/lib/moope/eventos-outbound";
import { cpfOuCnpjDigitos, telefoneE164 } from "@/lib/moope/telefone";
import type { MoopeConnectionRow } from "@/lib/moope/tipos";

export const TIMEOUT_LOCADORA_MS = 4_000;

const COLS_CONEXAO =
  "id, organization_id, kind, partner_webhook_url, partner_api_url, inbound_key_prefix, inbound_key_hash, outbound_secret_enc, status";

export type FalhaLocadora =
  | { ok: false; codigo: "sem_integracao" }
  | { ok: false; codigo: "sem_url" }
  | { ok: false; codigo: "sem_credencial" }
  | { ok: false; codigo: "entrada_invalida" }
  | { ok: false; codigo: "nao_encontrado" }
  | { ok: false; codigo: "ambiguo" }
  | { ok: false; codigo: "nao_autorizado" }
  | { ok: false; codigo: "indisponivel"; detalhe?: string };

export interface LookupLocatario {
  locatario_id: string;
  nome: string;
  contrato_status: string | null;
}

export interface RetratoLocatario {
  locatario_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  placa: string | null;
  contrato_titulo: string | null;
  contrato_status: string | null;
  faixa: string | null;
  amount_cents: number | null;
  days_late: number | null;
  portal_url: string | null;
  boleto_url: string | null;
  invoice_url: string | null;
}

export type ResultadoLookup = ({ ok: true } & LookupLocatario) | FalhaLocadora;
export type ResultadoRetrato = ({ ok: true } & RetratoLocatario) | FalhaLocadora;

export function urlDaApiDaLocadora(conn: Pick<MoopeConnectionRow, "partner_api_url" | "partner_webhook_url">): string | null {
  const explicita = conn.partner_api_url?.trim();
  if (explicita) return explicita.replace(/\/+$/, "");
  const webhook = conn.partner_webhook_url?.trim();
  if (!webhook) return null;
  try {
    return new URL(webhook).origin;
  } catch {
    return null;
  }
}

/** Canonical do GET: método + path + query. Sem body. A locadora verifica o mesmo. */
export function canonicalDoGet(url: URL): string {
  return `GET\n${url.pathname}${url.search}`;
}

export async function carregarConexaoLocadora(
  admin: SupabaseClient,
  orgId: string,
): Promise<MoopeConnectionRow | null> {
  const { data } = await admin
    .from("moope_connections")
    .select(COLS_CONEXAO)
    .eq("organization_id", orgId)
    .eq("kind", "locadora")
    .eq("status", "active")
    .maybeSingle();
  return (data as MoopeConnectionRow | null) ?? null;
}

async function prepararChamada(
  admin: SupabaseClient,
  orgId: string,
): Promise<
  | { ok: true; base: string; secret: string }
  | FalhaLocadora
> {
  const conn = await carregarConexaoLocadora(admin, orgId);
  if (!conn) return { ok: false, codigo: "sem_integracao" };
  const base = urlDaApiDaLocadora(conn);
  if (!base) return { ok: false, codigo: "sem_url" };
  if (!conn.outbound_secret_enc) return { ok: false, codigo: "sem_credencial" };
  const secret = await decryptWebhookSecret(admin, conn.outbound_secret_enc);
  if (!secret) return { ok: false, codigo: "sem_credencial" };
  return { ok: true, base, secret };
}

export async function getLocadora(
  url: URL,
  secret: string,
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ status: number; json: unknown } | { status: 0; json: null; detalhe: string }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const corpoVazio = "";
  const headers: Record<string, string> = {
    accept: "application/json",
    "X-Moope-Signature": assinarSaida(secret, canonicalDoGet(url)),
  };
  // GET não tem body; a assinatura é do canonical, não de um JSON.
  void corpoVazio;
  try {
    const res = await fetchFn(url.toString(), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_LOCADORA_MS),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch (err) {
    return {
      status: 0,
      json: null,
      detalhe: err instanceof Error ? err.message : "rede",
    };
  }
}

function falhaHttp(status: number, json: unknown, detalhe?: string): FalhaLocadora {
  if (status === 404) return { ok: false, codigo: "nao_encontrado" };
  if (status === 409) return { ok: false, codigo: "ambiguo" };
  if (status === 401 || status === 403) return { ok: false, codigo: "nao_autorizado" };
  if (status === 0 || status >= 500) {
    return { ok: false, codigo: "indisponivel", detalhe };
  }
  const msg =
    json && typeof json === "object" && "error" in json
      ? String((json as { error?: unknown }).error)
      : `http_${status}`;
  return { ok: false, codigo: "indisponivel", detalhe: msg };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function inteiro(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function lookupLocatario(
  admin: SupabaseClient,
  orgId: string,
  chave: { phone?: unknown; cpf?: unknown },
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoLookup> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;

  const phone = telefoneE164(chave.phone);
  const cpf = cpfOuCnpjDigitos(chave.cpf);
  if (!phone && !cpf) return { ok: false, codigo: "entrada_invalida" };

  const url = new URL("/api/crm/locatario", `${prep.base}/`);
  if (phone) url.searchParams.set("phone", phone);
  else if (cpf) url.searchParams.set("cpf", cpf);

  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const body = (res.json ?? {}) as Record<string, unknown>;
  const data =
    body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;
  const id = texto(data.locatario_id);
  const nome = texto(data.nome);
  if (!id || !nome) return { ok: false, codigo: "indisponivel", detalhe: "retrato_incompleto" };
  return {
    ok: true,
    locatario_id: id,
    nome,
    contrato_status: texto(data.contrato_status),
  };
}

export async function getRetratoLocatario(
  admin: SupabaseClient,
  orgId: string,
  locatarioId: string,
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoRetrato> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;

  const id = locatarioId.trim();
  if (!id) return { ok: false, codigo: "entrada_invalida" };

  const url = new URL(`/api/crm/locatario/${encodeURIComponent(id)}/retrato`, `${prep.base}/`);
  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const body = (res.json ?? {}) as Record<string, unknown>;
  const data =
    body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;
  const nome = texto(data.nome) ?? "";
  return {
    ok: true,
    locatario_id: texto(data.locatario_id) ?? id,
    nome,
    telefone: telefoneE164(data.telefone) ?? texto(data.telefone),
    email: texto(data.email),
    placa: texto(data.placa),
    contrato_titulo: texto(data.contrato_titulo) ?? texto(data.title),
    contrato_status: texto(data.contrato_status),
    faixa: texto(data.faixa),
    amount_cents: inteiro(data.amount_cents),
    days_late: inteiro(data.days_late),
    portal_url: texto(data.portal_url),
    boleto_url: texto(data.boleto_url),
    invoice_url: texto(data.invoice_url),
  };
}
