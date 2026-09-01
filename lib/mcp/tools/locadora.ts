/**
 * Tools do Operador — ler a locadora. O Conversador não vê estes nomes.
 *
 * Sem conexão / sem URL / 5xx: devolve código, não lança. O inbox não quebra.
 * Lookup 404 não cria cadastro. Retrato não chama Asaas nem Twilio.
 */
import { z } from "zod";

import {
  getAtendimento,
  getRetratoInvestidor,
  getRetratoLocatario,
  listarOferta,
  lookupInvestidor,
  lookupLocatario,
} from "@/lib/moope/cliente-locadora";
import { gravarRetratoNoContato } from "@/lib/moope/gravar-retrato";
import type { McpToolDefinition } from "../types";

function respostaDaFalha(codigo: string, detalhe?: string, papel = "locatário") {
  if (codigo === "nao_encontrado") {
    return {
      encontrado: false,
      aviso: `Não é ${papel} desta locadora. Não invente cadastro. Peça outra chave ou passe para um atendente.`,
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
  placa: z.string().optional().describe("Placa do veículo (ABC1D23). Use se o telefone não casar e a pessoa já tem contrato."),
};

export const moopeLookupLocatario: McpToolDefinition<typeof lookupShape> = {
  name: "moope_lookup_locatario",
  description:
    "Identifica locatário por telefone do WhatsApp, CPF ou placa. Não cria cadastro. " +
    "Telefone primeiro. Se não achar, peça CPF ou placa UMA vez. 404 = não é locatário.",
  inputSchema: lookupShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await lookupLocatario(ctx.supabase, ctx.organizationId, {
      phone: input.phone,
      cpf: input.cpf,
      placa: input.placa,
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
    "Situação do locatário: placa, modelo, contrato, atraso, tipos de documento e o que ele pode pedir. " +
    "Links só os que já existem (boleto/portal). Sem link, não invente — humano.",
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
      veiculo_modelo: r.veiculo_modelo,
      contrato_titulo: r.contrato_titulo,
      contrato_status: r.contrato_status,
      faixa: r.faixa,
      amount_cents: r.amount_cents,
      days_late: r.days_late,
      documentos: r.documentos,
      pode: r.pode,
      link_para_enviar: link,
      tem_link: Boolean(link),
      aviso: link
        ? "Pode falar este link no WhatsApp do atendimento. Não chame outro canal."
        : "Sem link de boleto ou portal. Não invente. Passe para um atendente.",
    };
  },
};

const emptyShape = {};

export const moopeGetAtendimento: McpToolDefinition<typeof emptyShape> = {
  name: "moope_get_atendimento",
  description:
    "Menu e regra de quem NÃO é locatário/investidor (`desconhecido`: passar, perguntar, oferta). " +
    "Menu só depois de identificar locatário. Sem cadastro, siga desconhecido_fazer — não peça CPF.",
  inputSchema: {},
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (_input, ctx) => {
    const r = await getAtendimento(ctx.supabase, ctx.organizationId);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    return {
      encontrado: Boolean(r.menu),
      menu: r.menu,
      papeis: r.papeis,
      identificar_por: r.identificar_por,
      locatario_pode: r.locatario_pode,
      investidor_pode: r.investidor_pode,
      lead_pode: r.lead_pode,
      desconhecido: r.desconhecido,
      desconhecido_fazer: r.desconhecido_fazer,
      aviso:
        r.desconhecido === "passar"
          ? "Sem cadastro: não responda. Handoff. Menu só para locatário identificado."
          : r.desconhecido_fazer || "Siga desconhecido. Menu só para locatário identificado.",
    };
  },
};

export const moopeListarOferta: McpToolDefinition<typeof emptyShape> = {
  name: "moope_listar_oferta",
  description:
    "Lista veículos DISPONÍVEIS para quem quer alugar (modelo, ano, placa). Sem valor inventado. " +
    "Lista vazia = não tem carro agora — passe para a equipe.",
  inputSchema: {},
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (_input, ctx) => {
    const r = await listarOferta(ctx.supabase, ctx.organizationId);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "lead");
    return {
      encontrado: r.itens.length > 0,
      itens: r.itens,
      aviso:
        r.itens.length > 0
          ? "Pode listar modelo e ano. Depois pergunte se quer que a equipe reserve. Não fecha contrato."
          : "Nenhum veículo disponível. Não invente. Passe para a equipe.",
    };
  },
};

const lookupInvShape = {
  phone: z.string().optional().describe("Telefone em E.164."),
  cpf: z.string().optional().describe("CPF do investidor."),
};

export const moopeLookupInvestidor: McpToolDefinition<typeof lookupInvShape> = {
  name: "moope_lookup_investidor",
  description:
    "Identifica investidor por telefone ou CPF. Não cria cadastro. Sem match = humano.",
  inputSchema: lookupInvShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await lookupInvestidor(ctx.supabase, ctx.organizationId, {
      phone: input.phone,
      cpf: input.cpf,
    });
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "investidor");
    return { encontrado: true, investidor_id: r.investidor_id, nome: r.nome };
  },
};

const retratoInvShape = {
  investidor_id: z.string().min(1).max(80).describe("Id do investidor (do lookup)."),
};

export const moopeGetRetratoInvestidor: McpToolDefinition<typeof retratoInvShape> = {
  name: "moope_get_retrato_investidor",
  description:
    "Portal e último período de fechamento do investidor. NÃO envie PDF. Extrato = link do portal ou humano.",
  inputSchema: retratoInvShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await getRetratoInvestidor(ctx.supabase, ctx.organizationId, input.investidor_id);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "investidor");
    return {
      encontrado: true,
      investidor_id: r.investidor_id,
      nome: r.nome,
      ultimo_periodo: r.ultimo_periodo,
      portal_url: r.portal_url,
      pode: r.pode,
      aviso: r.portal_url
        ? "Mande o link do portal. Fechamento e extrato estão lá. Não invente valor nem PDF."
        : "Sem portal. Passe para um atendente.",
    };
  },
};

export const TOOLS_IDS_OPERADOR_LOCADORA = [
  "moope_lookup_locatario",
  "moope_get_retrato",
  "moope_get_atendimento",
  "moope_listar_oferta",
  "moope_lookup_investidor",
  "moope_get_retrato_investidor",
] as const;
