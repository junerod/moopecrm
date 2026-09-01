/**
 * Tools do Operador — ler a locadora. O Conversador não vê estes nomes.
 *
 * Sem conexão / sem URL / 5xx: devolve código, não lança. O inbox não quebra.
 * Lookup 404 não cria cadastro. Retrato não chama Asaas nem Twilio.
 */
import { z } from "zod";

import { getRetratoLocatario, lookupLocatario } from "@/lib/moope/cliente-locadora";
import { gravarRetratoNoContato } from "@/lib/moope/gravar-retrato";
import type { McpToolDefinition } from "../types";

function respostaDaFalha(codigo: string, detalhe?: string) {
  if (codigo === "nao_encontrado") {
    return {
      encontrado: false,
      aviso: "Não é locatário desta locadora. Não invente cadastro. Passe para um atendente.",
    };
  }
  if (codigo === "ambiguo") {
    return {
      encontrado: false,
      aviso: "Há mais de um cadastro com essa chave. Passe para um atendente — não chute.",
    };
  }
  if (codigo === "sem_integracao" || codigo === "sem_url" || codigo === "sem_credencial") {
    return {
      encontrado: false,
      aviso: "A locadora não está ligada nesta organização. Passe para um atendente.",
    };
  }
  if (codigo === "nao_autorizado") {
    return {
      encontrado: false,
      aviso: "A locadora recusou a credencial. Passe para um atendente.",
    };
  }
  return {
    encontrado: false,
    aviso: "Sistema da locadora indisponível. Passe para um atendente.",
    ...(detalhe ? { detalhe } : {}),
  };
}

const lookupShape = {
  phone: z.string().optional().describe("Telefone em E.164 (+55…). Preferir o do WhatsApp."),
  cpf: z.string().optional().describe("CPF ou CNPJ, só os dígitos ou com máscara."),
};

export const moopeLookupLocatario: McpToolDefinition<typeof lookupShape> = {
  name: "moope_lookup_locatario",
  description:
    "Identifica se o telefone ou o CPF é locatário desta locadora. Não cria cadastro. " +
    "Use o telefone da conversa primeiro. Só peça CPF se o telefone não casar. " +
    "404 = não é cliente — passe para um atendente. Nunca invente locatário.",
  inputSchema: lookupShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await lookupLocatario(ctx.supabase, ctx.organizationId, {
      phone: input.phone,
      cpf: input.cpf,
    });
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    return {
      encontrado: true,
      locatario_id: r.locatario_id,
      nome: r.nome,
      contrato_status: r.contrato_status,
    };
  },
};

const retratoShape = {
  locatario_id: z.string().min(1).max(80).describe("Id do locatário na locadora (do lookup)."),
};

export const moopeGetRetrato: McpToolDefinition<typeof retratoShape> = {
  name: "moope_get_retrato",
  description:
    "Lê a situação atual do locatário: nome, placa, contrato, faixa, valor em atraso e " +
    "os links de boleto/portal que JÁ existem. Não gera cobrança, não marca pago, " +
    "não manda WhatsApp de outro número. Sem link, o Conversador não inventa URL — " +
    "pede um atendente.",
  inputSchema: retratoShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await getRetratoLocatario(ctx.supabase, ctx.organizationId, input.locatario_id);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    await gravarRetratoNoContato(ctx.supabase, ctx.organizationId, r).catch(() => undefined);
    const link = r.boleto_url ?? r.invoice_url ?? r.portal_url;
    return {
      encontrado: true,
      locatario_id: r.locatario_id,
      nome: r.nome,
      placa: r.placa,
      contrato_titulo: r.contrato_titulo,
      contrato_status: r.contrato_status,
      faixa: r.faixa,
      amount_cents: r.amount_cents,
      days_late: r.days_late,
      link_para_enviar: link,
      tem_link: Boolean(link),
      aviso: link
        ? "Pode falar este link no WhatsApp do atendimento. Não chame outro canal."
        : "Sem link de boleto ou portal. Não invente. Passe para um atendente.",
    };
  },
};

export const TOOLS_IDS_OPERADOR_LOCADORA = ["moope_lookup_locatario", "moope_get_retrato"] as const;
