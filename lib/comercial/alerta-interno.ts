/**
 * Alerta INTERNO ao atendente — não é conversa CRM, campanha, nem takeover.
 *
 * NÃO usa `send_intent` de POST /messages. `operational_moope` é Gestão
 * falando com o CLIENTE. Este caminho é `alerta_interno_atendente`:
 * destinatário = telefone particular do atendente; nunca o do lead.
 */

import { rotuloDoAtraso } from "@/lib/comercial/proxima-acao";
import { normalizarE164 } from "@/lib/comercial/telefone-e164";

export const CLASSIFICACAO_ALERTA_INTERNO = "alerta_interno_atendente" as const;

export type KindDeAlerta = "pre_due" | "overdue";

export const ANTECEDENCIAS_MIN = [10, 30, 60] as const;
export type AntecedenciaMin = (typeof ANTECEDENCIAS_MIN)[number];

export interface PrefsDeAlerta {
  enabled: boolean;
  phone: string | null;
  antecedenciaMin: AntecedenciaMin;
}

export interface AcaoParaAlerta {
  demandaId: string;
  organizationId: string;
  texto: string;
  em: string;
  donoUserId: string | null;
  contactName: string;
  /** Telefone do CLIENTE — só para provar que NÃO é o destinatário. */
  clientPhone?: string | null;
}

export function chaveDeIdempotencia(entrada: {
  demandaId: string;
  kind: KindDeAlerta;
  dueAt: string;
}): string {
  const due = new Date(entrada.dueAt);
  const bucket = Number.isNaN(due.getTime()) ? entrada.dueAt : due.toISOString();
  return `${entrada.demandaId}:${entrada.kind}:${bucket}`;
}

export function elegivelParaAlerta(entrada: {
  acao: AcaoParaAlerta;
  prefs: PrefsDeAlerta;
  kind: KindDeAlerta;
  agora: Date;
  jaEnviado: boolean;
}): { ok: true; dest: string } | { ok: false; motivo: string } {
  if (entrada.jaEnviado) return { ok: false, motivo: "ja_enviado" };
  if (!entrada.prefs.enabled) return { ok: false, motivo: "opt_out" };
  const dest = normalizarE164(entrada.prefs.phone);
  if (!dest) return { ok: false, motivo: "sem_telefone" };
  const cliente = normalizarE164(entrada.acao.clientPhone ?? null);
  if (cliente && cliente === dest) {
    // Número do atendente NÃO pode ser o do cliente — fail closed.
    return { ok: false, motivo: "telefone_e_do_cliente" };
  }
  if (!entrada.acao.donoUserId) return { ok: false, motivo: "sem_responsavel" };

  const due = new Date(entrada.acao.em);
  if (Number.isNaN(due.getTime())) return { ok: false, motivo: "data_invalida" };

  if (entrada.kind === "pre_due") {
    const dispara = due.getTime() - entrada.prefs.antecedenciaMin * 60_000;
    if (entrada.agora.getTime() < dispara) return { ok: false, motivo: "cedo_demais" };
    if (entrada.agora.getTime() >= due.getTime()) return { ok: false, motivo: "ja_venceu" };
  } else {
    if (entrada.agora.getTime() < due.getTime()) return { ok: false, motivo: "ainda_nao_venceu" };
  }
  return { ok: true, dest };
}

export function montarMensagemAlerta(entrada: {
  kind: KindDeAlerta;
  contactName: string;
  texto: string;
  em: string;
  agora?: Date;
}): string {
  if (entrada.kind === "pre_due") {
    const hora = new Date(entrada.em);
    const hh = String(hora.getHours()).padStart(2, "0");
    const mm = String(hora.getMinutes()).padStart(2, "0");
    return [
      "🔔 MOOPE CRM",
      "Compromisso em breve",
      "",
      entrada.contactName,
      entrada.texto,
      `${hh}:${mm}`,
    ].join("\n");
  }
  const atraso = rotuloDoAtraso(entrada.em, entrada.agora ?? new Date()) ?? "Atrasada";
  return [
    "⚠️ MOOPE CRM",
    "Próxima ação atrasada",
    "",
    entrada.contactName,
    entrada.texto,
    atraso,
  ].join("\n");
}
