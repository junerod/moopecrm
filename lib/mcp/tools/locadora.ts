/**
 * Tools do Operador — ler a locadora. O Conversador não vê estes nomes.
 *
 * Sem conexão / sem URL / 5xx: devolve código, não lança. O inbox não quebra.
 * Lookup 404 não cria cadastro. Retrato não chama Asaas nem API de mensagens.
 */
import { z } from "zod";

import {
  consultarDisponibilidade,
  consultarDocumentos,
  consultarFinanceiro,
  consultarLocacao,
  consultarManutencao,
  consultarMultas,
  consultarSinistros,
  consultarVistoria,
  getAtendimento,
  getRetratoInvestidor,
  getRetratoLocatario,
  listarOferta,
  listarUnidades,
  lookupInvestidor,
  lookupLocatario,
  obterSegundaVia,
} from "@/lib/moope/cliente-locadora";
import { resolverCriterioDeIdentidade } from "@/lib/business-packs/identidade";
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
      oferta_fazer: r.oferta_fazer,
      aviso:
        r.desconhecido === "passar"
          ? "Sem cadastro: não responda. Handoff. Menu só para locatário identificado."
          : r.desconhecido_fazer || "Siga desconhecido. Menu só para locatário identificado.",
    };
  },
};

const ofertaShape = {
  propulsao: z
    .enum(["eletrico", "combustao", "hibrido"])
    .optional()
    .describe("Só se a pessoa pediu elétrico, combustão ou híbrido."),
  visao: z
    .enum(["disponiveis", "todos", "alugados_fim"])
    .optional()
    .describe("Deixe vazio: usa a visão da página de ofertas da locadora."),
};

export const moopeListarOferta: McpToolDefinition<typeof ofertaShape> = {
  name: "moope_listar_oferta",
  description:
    "Lista a frota da página de ofertas (modelo, ano, preços se existirem, opcionais, se é elétrico, se está ALUGADO). " +
    "Quem veio da página de ofertas ou pediu carro/alugar/valores: chame e liste TODOS os itens. Não invente preço. " +
    "Item ALUGADO: diga que está alugado e ofereça avisar quando liberar. Lista vazia = passe para a equipe.",
  inputSchema: ofertaShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await listarOferta(ctx.supabase, ctx.organizationId, {}, {
      visao: input.visao,
      propulsao: input.propulsao,
    });
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "lead");
    return {
      encontrado: r.itens.length > 0,
      itens: r.itens,
      aviso:
        r.itens.length > 0
          ? "Liste todos. Preço e opcionais só se vierem no item. ALUGADO: não ofereça para hoje. Depois pergunte se quer a equipe. Não fecha contrato."
          : "Nenhum veículo nesta lista. Não invente. Passe para a equipe.",
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

function mascararTelefone(telefone: string | null): string | null {
  if (!telefone) return null;
  const d = telefone.replace(/\D/g, "");
  if (d.length < 8) return telefone;
  return `${telefone.slice(0, 4)}****${telefone.slice(-2)}`;
}

const clienteShape = {
  external_id: z.string().optional().describe("Id persistido do locatário na gestão."),
  phone: z.string().optional().describe("Telefone em E.164."),
  identificador: z.string().optional().describe("Identificador explícito informado pelo cliente."),
  cpf: z.string().optional().describe("CPF ou CNPJ só quando necessário."),
  nome: z.string().optional().describe("Nome sozinho nunca identifica."),
};

export const moopeConsultarCliente: McpToolDefinition<typeof clienteShape> = {
  name: "moope_consultar_cliente",
  description:
    "Perfil resumido do locatário. Identidade: vínculo persistido, telefone, identificador explícito ou CPF. Nome sozinho não identifica. Ambíguo: falha fechada.",
  inputSchema: clienteShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const id = resolverCriterioDeIdentidade({
      external_id: input.external_id,
      telefone: input.phone,
      identificador: input.identificador,
      cpf_cnpj: input.cpf,
      nome: input.nome,
    });
    if (!id.ok) {
      return {
        encontrado: false,
        aviso:
          id.motivo === "nome_sozinho"
            ? "Nome sozinho não identifica. Peça telefone, contrato ou documento."
            : "Falta um identificador seguro. Peça telefone ou documento.",
      };
    }
    const r = await lookupLocatario(ctx.supabase, ctx.organizationId, {
      external_id: input.external_id ?? input.identificador,
      phone: input.phone,
      cpf: input.cpf,
    });
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    const retrato = await getRetratoLocatario(ctx.supabase, ctx.organizationId, r.locatario_id);
    if (!retrato.ok) {
      return {
        encontrado: true,
        locatario_id: r.locatario_id,
        nome: r.nome,
        contrato_status: r.contrato_status,
        aviso: "Identifiquei o cliente, mas não consegui o detalhe agora.",
      };
    }
    return {
      encontrado: true,
      locatario_id: retrato.locatario_id,
      nome: retrato.nome,
      status: retrato.contrato_status,
      telefone_mascarado: mascararTelefone(retrato.telefone),
      contrato_ativo: retrato.contrato_titulo,
      veiculo_atual: retrato.veiculo_modelo,
      situacao: retrato.faixa,
    };
  },
};

const idShape = {
  locatario_id: z.string().min(1).max(80).describe("Id do locatário (do lookup)."),
};

export const moopeConsultarLocacao: McpToolDefinition<typeof idShape> = {
  name: "moope_consultar_locacao",
  description: "Contratos/locações ativas: início, término, veículo e status. Só leitura.",
  inputSchema: idShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await consultarLocacao(ctx.supabase, ctx.organizationId, input.locatario_id);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    return { encontrado: r.itens.length > 0, itens: r.itens };
  },
};

export const moopeConsultarFinanceiro: McpToolDefinition<typeof idShape> = {
  name: "moope_consultar_financeiro",
  description: "Parcelas, vencimentos, atraso e links oficiais já existentes. Não emite cobrança.",
  inputSchema: idShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await consultarFinanceiro(ctx.supabase, ctx.organizationId, input.locatario_id);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    return {
      encontrado: r.parcelas.length > 0 || Boolean(r.boleto_url || r.pix_url || r.portal_url),
      parcelas: r.parcelas,
      boleto_url: r.boleto_url,
      pix_url: r.pix_url,
      portal_url: r.portal_url,
      aviso: "Links só os que a gestão já gerou. Não invente cobrança.",
    };
  },
};

export const moopeObterSegundaVia: McpToolDefinition<typeof idShape> = {
  name: "moope_obter_segunda_via",
  description: "Devolve boleto/PIX/portal já existentes. Não emite cobrança nova.",
  inputSchema: idShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await obterSegundaVia(ctx.supabase, ctx.organizationId, input.locatario_id);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
    const link = r.boleto_url ?? r.pix_url ?? r.portal_url;
    return {
      encontrado: Boolean(link),
      boleto_url: r.boleto_url,
      pix_url: r.pix_url,
      portal_url: r.portal_url,
      aviso: link ? "Pode enviar este link oficial." : "Não há segunda via pronta. Não invente. Humano.",
    };
  },
};

const dispShape = {
  inicio: z.string().min(8).describe("Data início YYYY-MM-DD."),
  fim: z.string().min(8).describe("Data fim YYYY-MM-DD."),
  categoria: z.string().optional(),
  unidade: z.string().optional(),
};

export const moopeConsultarDisponibilidade: McpToolDefinition<typeof dispShape> = {
  name: "moope_consultar_disponibilidade",
  description:
    "Disponibilidade REAL por período. Nunca use status genérico da frota. Sem período, não afirma.",
  inputSchema: dispShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await consultarDisponibilidade(ctx.supabase, ctx.organizationId, input);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "lead");
    return {
      encontrado: r.situacao !== "consulta_indisponivel",
      situacao: r.situacao,
      categoria: r.categoria,
      unidade: r.unidade,
      inicio: r.inicio,
      fim: r.fim,
      preco: r.preco,
      aviso:
        r.situacao === "consulta_indisponivel"
          ? "Não consegui consultar essa informação agora."
          : r.situacao === "disponivel"
            ? "Disponível no período informado pela gestão."
            : "Indisponível no período informado pela gestão.",
    };
  },
};

function listaTool(
  name: string,
  description: string,
  consultar: typeof consultarManutencao,
): McpToolDefinition<typeof idShape> {
  return {
    name,
    description,
    inputSchema: idShape,
    category: "read",
    requiresRole: "agent",
    requiresScope: "mcp:read",
    handler: async (input, ctx) => {
      const r = await consultar(ctx.supabase, ctx.organizationId, input.locatario_id);
      if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined);
      return { encontrado: r.itens.length > 0, itens: r.itens };
    },
  };
}

export const moopeConsultarManutencao = listaTool(
  "moope_consultar_manutencao",
  "Manutenção autorizada para o locatário. Sem detalhe técnico desnecessário.",
  consultarManutencao,
);
export const moopeConsultarMultas = listaTool(
  "moope_consultar_multas",
  "Multas do cliente/contrato autorizado: data, resumo, valor e status.",
  consultarMultas,
);
export const moopeConsultarSinistros = listaTool(
  "moope_consultar_sinistros",
  "Sinistros autorizados. Só leitura.",
  consultarSinistros,
);
export const moopeConsultarVistoria = listaTool(
  "moope_consultar_vistoria",
  "Vistoria/checklist autorizado. Referência, não arquivo privado de outra pessoa.",
  consultarVistoria,
);
export const moopeConsultarDocumentos = listaTool(
  "moope_consultar_documentos",
  "Documentos autorizados do locatário identificado. Não envie arquivo de outra pessoa.",
  consultarDocumentos,
);

const emptyUnidades = {};
export const moopeListarUnidades: McpToolDefinition<typeof emptyUnidades> = {
  name: "moope_listar_unidades",
  description: "Unidades/filiais que a gestão realmente tem. Não invente filial.",
  inputSchema: {},
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (_input, ctx) => {
    const r = await listarUnidades(ctx.supabase, ctx.organizationId);
    if (!r.ok) return respostaDaFalha(r.codigo, "detalhe" in r ? r.detalhe : undefined, "lead");
    return { encontrado: r.itens.length > 0, itens: r.itens };
  },
};

export const TOOLS_IDS_OPERADOR_LOCADORA = [
  "moope_lookup_locatario",
  "moope_get_retrato",
  "moope_get_atendimento",
  "moope_listar_oferta",
  "moope_lookup_investidor",
  "moope_get_retrato_investidor",
  "moope_consultar_cliente",
  "moope_consultar_locacao",
  "moope_consultar_financeiro",
  "moope_obter_segunda_via",
  "moope_consultar_disponibilidade",
  "moope_consultar_manutencao",
  "moope_consultar_multas",
  "moope_consultar_sinistros",
  "moope_consultar_vistoria",
  "moope_consultar_documentos",
  "moope_listar_unidades",
] as const;
