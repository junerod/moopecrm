/**
 * Texto de produto do Pack — sem ids internos, sem MCP, sem RAG.
 * O instalador não passa daqui; só a tela lê.
 */
import type { BusinessPackDefinition, BusinessPackGravado } from "@/lib/business-packs/tipos";

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
};

export const PERGUNTA_DE_TESTE: Record<string, string> = {
  recepcao: "Oi, quero falar com vocês.",
  comercial: "Quero alugar um carro de amanhã até sexta.",
  financeiro: "Preciso da segunda via do meu boleto.",
  disponibilidade: "Tem SUV disponível?",
  atendimento: "Quero prorrogar minha locação.",
  relacionamento: "Faz tempo que não alugo. Ainda trabalham com vocês?",
};

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
    description: TEXTO_DO_PACK[spec.key]?.oQueFaz ?? spec.description,
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
      oQueFaz: TEXTO_DO_PACK[s.key]?.oQueFaz ?? s.description,
      papel: TEXTO_DO_PACK[s.key]?.papel ?? s.description,
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
