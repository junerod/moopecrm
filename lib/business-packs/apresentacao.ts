/**
 * Texto de produto do Pack — sem ids internos, sem MCP, sem RAG.
 * O instalador não passa daqui; só a tela lê.
 */
import type { BusinessPackDefinition, BusinessPackGravado, BusinessPackId } from "@/lib/business-packs/tipos";

export const TEXTO_DO_PACK: Record<
  string,
  { oQueFaz: string; papel: string }
> = {
  recepcao: {
    oQueFaz: "Recebe e direciona os atendimentos",
    papel: "Recepção e triagem",
  },
  comercial: {
    oQueFaz: "Qualifica interessados e acompanha propostas",
    papel: "Orçamentos, qualificação e vendas",
  },
  financeiro: {
    oQueFaz: "Ajuda com cobranças, boletos e vencimentos",
    papel: "Boletos, vencimentos e pagamentos",
  },
  disponibilidade: {
    oQueFaz: "Ajuda com pedidos e disponibilidade de veículos",
    papel: "Consulta ou coleta pedidos de veículos",
  },
  atendimento: {
    oQueFaz: "Ajuda durante a locação",
    papel: "Locação, devolução, manutenção e suporte",
  },
  relacionamento: {
    oQueFaz: "Follow-up e reativação",
    papel: "Follow-up e reativação",
  },
  documentos: {
    oQueFaz: "Pede documentos e confirma pendências",
    papel: "Checklist documental",
  },
};

const TEXTO_ADVOCACIA: Record<string, { oQueFaz: string; papel: string }> = {
  recepcao: {
    oQueFaz: "Recebe, identifica cliente ou novo contato e encaminha",
    papel: "Recepção e triagem",
  },
  comercial: {
    oQueFaz: "Qualifica novos clientes e agenda consulta",
    papel: "Qualificação, origem e follow-up comercial",
  },
  atendimento: {
    oQueFaz: "Orienta o lado administrativo do atendimento",
    papel: "Agendamento, documentos e encaminhamento",
  },
  documentos: {
    oQueFaz: "Pede documentos faltantes e confirma recebimento",
    papel: "Checklist documental",
  },
  financeiro: {
    oQueFaz: "Informa honorários e parcelas só com fonte confiável",
    papel: "Honorários, vencimentos e links oficiais",
  },
  relacionamento: {
    oQueFaz: "Follow-up, satisfação e reativação",
    papel: "Retorno e relacionamento",
  },
};

const TEXTO_POR_PACK: Partial<Record<BusinessPackId, Record<string, { oQueFaz: string; papel: string }>>> = {
  escritorio_advocacia: TEXTO_ADVOCACIA,
};

export const PERGUNTA_DE_TESTE: Record<string, string> = {
  recepcao: "Oi, quero falar com vocês.",
  comercial: "Quero alugar um carro de amanhã até sexta.",
  financeiro: "Preciso da segunda via do meu boleto.",
  disponibilidade: "Tem SUV disponível?",
  atendimento: "Quero prorrogar minha locação.",
  relacionamento: "Faz tempo que não alugo. Ainda trabalham com vocês?",
  documentos: "Quais documentos preciso levar?",
};

const PERGUNTA_ADVOCACIA: Record<string, string> = {
  recepcao: "Quero falar com um advogado sobre meu caso.",
  comercial: "Quero marcar uma consulta.",
  atendimento: "Como está meu processo?",
  documentos: "Quais documentos preciso levar?",
  financeiro: "Quanto custa?",
  relacionamento: "Estou passando para saber se conseguiu avaliar as informações.",
};

export function textoDaEspecialidade(
  definition: BusinessPackDefinition | null,
  key: string,
): { oQueFaz: string; papel: string } | undefined {
  if (definition) {
    const doPack = TEXTO_POR_PACK[definition.id]?.[key];
    if (doPack) return doPack;
  }
  return TEXTO_DO_PACK[key];
}

export function perguntaDeTeste(definition: BusinessPackDefinition | null, key: string): string {
  if (definition?.id === "escritorio_advocacia" && PERGUNTA_ADVOCACIA[key]) {
    return PERGUNTA_ADVOCACIA[key];
  }
  return PERGUNTA_DE_TESTE[key] ?? "Oi, preciso de ajuda.";
}

export function chaveDaEspecialidade(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const key = (config as Record<string, unknown>).pack_specialty_key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

export function especialidadeDoAgente(
  agent: { name: string; config?: unknown },
  definition: BusinessPackDefinition | null,
): { key: string; name: string; description: string; isPrincipal: boolean } | null {
  if (!definition) return null;
  const porChave = chaveDaEspecialidade(agent.config);
  const spec =
    definition.specialties.find((s) => s.key === porChave) ??
    definition.specialties.find((s) => s.name === agent.name);
  if (!spec) return null;
  return {
    key: spec.key,
    name: spec.name,
    description: textoDaEspecialidade(definition, spec.key)?.oQueFaz ?? spec.description,
    isPrincipal: Boolean(spec.is_default),
  };
}

export function resumoDoPack(definition: BusinessPackDefinition) {
  return {
    assistentes: definition.specialties.length,
    etapas: definition.pipeline.etapas.length,
    colecoes: definition.collections.length,
    automacoes: definition.automations.length,
    respostas: definition.quick_replies.length,
    campanhas: definition.campaigns.length,
  };
}

export function packEstaAtivo(gravado: BusinessPackGravado | null): boolean {
  return gravado !== null && gravado.id.length > 0 && gravado.status !== "inactive";
}

export function detalhesDoPack(definition: BusinessPackDefinition) {
  return {
    assistentes: definition.specialties.map((s) => ({
      key: s.key,
      name: s.name,
      oQueFaz: textoDaEspecialidade(definition, s.key)?.oQueFaz ?? s.description,
      papel: textoDaEspecialidade(definition, s.key)?.papel ?? s.description,
      principal: Boolean(s.is_default),
    })),
    etapas: definition.pipeline.etapas.map((e) => e.nome),
    colecoes: definition.collections.map((c) => ({ slug: c.slug, name: c.name })),
    automacoes: definition.automations.map((a) => ({
      key: a.key,
      name: a.name,
      precisaGestao: Boolean(a.requires_gestao),
    })),
    respostas: definition.quick_replies.map((q) => q.title),
    campanhas: definition.campaigns.map((c) => c.title),
  };
}
