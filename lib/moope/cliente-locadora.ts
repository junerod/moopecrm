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
  veiculo_modelo: string | null;
  contrato_titulo: string | null;
  contrato_status: string | null;
  faixa: string | null;
  amount_cents: number | null;
  days_late: number | null;
  portal_url: string | null;
  boleto_url: string | null;
  invoice_url: string | null;
  documentos: string[];
  pode: string[];
}

export interface ScriptAtendimento {
  menu: string | null;
  papeis: string[];
  identificar_por: string[];
  locatario_pode: string[];
  investidor_pode: string[];
  lead_pode: string[];
  desconhecido: "passar" | "perguntar" | "oferta";
  desconhecido_fazer: string | null;
  oferta_fazer: string | null;
}

export interface OfertaItem {
  modelo: string;
  marca: string | null;
  ano: number | null;
  placa: string | null;
  valor_diario: number | null;
  valor_semanal: number | null;
  valor_mensal: number | null;
  status: string | null;
  propulsao: string | null;
  eletrico: boolean;
  opcionais: string | null;
  foto_url: string | null;
}

export interface LookupInvestidor {
  investidor_id: string;
  nome: string;
}

export interface RetratoInvestidor {
  investidor_id: string;
  nome: string;
  telefone: string | null;
  ultimo_periodo: string | null;
  portal_url: string | null;
  pode: string[];
}

export type ResultadoLookup = ({ ok: true } & LookupLocatario) | FalhaLocadora;
export type ResultadoRetrato = ({ ok: true } & RetratoLocatario) | FalhaLocadora;
export type ResultadoAtendimento = ({ ok: true } & ScriptAtendimento) | FalhaLocadora;
export type ResultadoOferta = ({ ok: true; itens: OfertaItem[] } ) | FalhaLocadora;
export type ResultadoLookupInvestidor = ({ ok: true } & LookupInvestidor) | FalhaLocadora;
export type ResultadoRetratoInvestidor = ({ ok: true } & RetratoInvestidor) | FalhaLocadora;

function placaNormalizada(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const s = valor.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return s.length >= 6 && s.length <= 8 ? s : undefined;
}

function listaTexto(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

function corpoData(json: unknown): Record<string, unknown> {
  const body = (json ?? {}) as Record<string, unknown>;
  if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

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

function dinheiro(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export async function lookupLocatario(
  admin: SupabaseClient,
  orgId: string,
  chave: { phone?: unknown; cpf?: unknown; placa?: unknown },
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoLookup> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;

  const phone = telefoneE164(chave.phone);
  const cpf = cpfOuCnpjDigitos(chave.cpf);
  const placa = placaNormalizada(chave.placa);
  if (!phone && !cpf && !placa) return { ok: false, codigo: "entrada_invalida" };

  const url = new URL("/api/crm/locatario", `${prep.base}/`);
  if (phone) url.searchParams.set("phone", phone);
  if (cpf) url.searchParams.set("cpf", cpf);
  if (placa) url.searchParams.set("placa", placa);

  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const data = corpoData(res.json);
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
  const data = corpoData(res.json);
  const nome = texto(data.nome) ?? "";
  return {
    ok: true,
    locatario_id: texto(data.locatario_id) ?? id,
    nome,
    telefone: telefoneE164(data.telefone) ?? texto(data.telefone),
    email: texto(data.email),
    placa: texto(data.placa),
    veiculo_modelo: texto(data.veiculo_modelo),
    contrato_titulo: texto(data.contrato_titulo) ?? texto(data.title),
    contrato_status: texto(data.contrato_status),
    faixa: texto(data.faixa),
    amount_cents: inteiro(data.amount_cents),
    days_late: inteiro(data.days_late),
    portal_url: texto(data.portal_url),
    boleto_url: texto(data.boleto_url),
    invoice_url: texto(data.invoice_url),
    documentos: listaTexto(data.documentos),
    pode: listaTexto(data.pode),
  };
}

export async function getAtendimento(
  admin: SupabaseClient,
  orgId: string,
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoAtendimento> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;
  const url = new URL("/api/crm/atendimento", `${prep.base}/`);
  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const data = corpoData(res.json);
  return {
    ok: true,
    menu: texto(data.menu),
    papeis: listaTexto(data.papeis),
    identificar_por: listaTexto(data.identificar_por),
    locatario_pode: listaTexto(data.locatario_pode),
    investidor_pode: listaTexto(data.investidor_pode),
    lead_pode: listaTexto(data.lead_pode),
    desconhecido:
      data.desconhecido === "perguntar" || data.desconhecido === "oferta"
        ? data.desconhecido
        : "passar",
    desconhecido_fazer: texto(data.desconhecido_fazer),
    oferta_fazer: texto(data.oferta_fazer),
  };
}

export async function listarOferta(
  admin: SupabaseClient,
  orgId: string,
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
  filtros: { visao?: string; propulsao?: string } = {},
): Promise<ResultadoOferta> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;
  const url = new URL("/api/crm/oferta", `${prep.base}/`);
  const visao = String(filtros.visao || "").trim().toLowerCase();
  const propulsao = String(filtros.propulsao || "").trim().toLowerCase();
  if (visao === "disponiveis" || visao === "todos" || visao === "alugados_fim") {
    url.searchParams.set("visao", visao);
  }
  if (propulsao === "eletrico" || propulsao === "combustao" || propulsao === "hibrido") {
    url.searchParams.set("propulsao", propulsao);
  }
  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const body = (res.json ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  const itens: OfertaItem[] = raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .map((r) => {
      const status = String(texto(r.status) || "DISPONIVEL").toUpperCase();
      return {
        modelo: texto(r.modelo) ?? "Veículo",
        marca: texto(r.marca),
        ano: inteiro(r.ano),
        placa: texto(r.placa),
        valor_diario: dinheiro(r.valor_diario),
        valor_semanal: dinheiro(r.valor_semanal),
        valor_mensal: dinheiro(r.valor_mensal),
        status: status === "ALUGADO" || status === "RESERVADO" ? status : "DISPONIVEL",
        propulsao: texto(r.propulsao),
        eletrico: r.eletrico === true || texto(r.propulsao) === "eletrico",
        opcionais: texto(r.opcionais),
        foto_url: texto(r.foto_url),
      };
    });
  return { ok: true, itens };
}

export async function lookupInvestidor(
  admin: SupabaseClient,
  orgId: string,
  chave: { phone?: unknown; cpf?: unknown },
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoLookupInvestidor> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;
  const phone = telefoneE164(chave.phone);
  const cpf = cpfOuCnpjDigitos(chave.cpf);
  if (!phone && !cpf) return { ok: false, codigo: "entrada_invalida" };
  const url = new URL("/api/crm/investidor", `${prep.base}/`);
  if (phone) url.searchParams.set("phone", phone);
  if (cpf) url.searchParams.set("cpf", cpf);
  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const data = corpoData(res.json);
  const id = texto(data.investidor_id);
  const nome = texto(data.nome);
  if (!id || !nome) return { ok: false, codigo: "indisponivel", detalhe: "retrato_incompleto" };
  return { ok: true, investidor_id: id, nome };
}

export async function getRetratoInvestidor(
  admin: SupabaseClient,
  orgId: string,
  investidorId: string,
  deps: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoRetratoInvestidor> {
  const prep = await prepararChamada(admin, orgId);
  if (!prep.ok) return prep;
  const id = investidorId.trim();
  if (!id) return { ok: false, codigo: "entrada_invalida" };
  const url = new URL(`/api/crm/investidor/${encodeURIComponent(id)}/retrato`, `${prep.base}/`);
  const res = await getLocadora(url, prep.secret, deps);
  if (res.status !== 200) {
    return falhaHttp(res.status, res.json, "detalhe" in res ? res.detalhe : undefined);
  }
  const data = corpoData(res.json);
  return {
    ok: true,
    investidor_id: texto(data.investidor_id) ?? id,
    nome: texto(data.nome) ?? "",
    telefone: telefoneE164(data.telefone) ?? texto(data.telefone),
    ultimo_periodo: texto(data.ultimo_periodo),
    portal_url: texto(data.portal_url),
    pode: listaTexto(data.pode),
  };
}
