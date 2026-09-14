/**
 * Test-drive — classifica e monta a resposta SEM enviar WhatsApp e SEM
 * chamar tool externa. O que a tool faria aparece como intenção.
 */
import { catalogoAmigavel } from "@/lib/business-packs/capacidades";
import {
  classificarIntencao,
  especialidadeDoIntent,
  intentEhOperacional,
  intentEhSensivel,
} from "@/lib/business-packs/intents";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";

export interface CenarioDeTeste {
  id: string;
  rotulo: string;
  mensagem: string;
}

export const CENARIOS_TEST_DRIVE: CenarioDeTeste[] = [
  { id: "alugar", rotulo: "Quero alugar", mensagem: "Quero alugar um carro de amanhã até sexta." },
  { id: "suv", rotulo: "Disponibilidade", mensagem: "Tem SUV disponível?" },
  { id: "boleto", rotulo: "Boleto", mensagem: "Preciso da segunda via do meu boleto." },
  { id: "sinistro", rotulo: "Sinistro", mensagem: "Bati o carro. O que faço?" },
  { id: "prorrogar", rotulo: "Prorrogação", mensagem: "Quero prorrogar minha locação." },
];

const CENARIOS_ADVOCACIA: CenarioDeTeste[] = [
  { id: "advogado", rotulo: "Falar com advogado", mensagem: "Quero falar com um advogado sobre meu caso." },
  { id: "documentos", rotulo: "Documentos", mensagem: "Quais documentos preciso levar?" },
  { id: "honorario", rotulo: "Honorários", mensagem: "Quanto custa?" },
  { id: "andamento", rotulo: "Andamento", mensagem: "Como está meu processo?" },
  { id: "decisao", rotulo: "Decisão", mensagem: "Qual foi a decisão do juiz?" },
  { id: "consulta", rotulo: "Consulta", mensagem: "Quero marcar uma consulta." },
];

const CENARIOS_SAAS: CenarioDeTeste[] = [
  { id: "demo", rotulo: "Demo", mensagem: "Quero uma demo do sistema." },
  { id: "preco", rotulo: "Preço", mensagem: "Quanto custa o plano?" },
  { id: "sla", rotulo: "Implantação", mensagem: "Qual o prazo de implantação?" },
  { id: "proposta", rotulo: "Proposta", mensagem: "Podem enviar a proposta?" },
];

const CENARIOS_COMERCIAL: CenarioDeTeste[] = [
  { id: "orcamento", rotulo: "Orçamento", mensagem: "Quero um orçamento." },
  { id: "preco", rotulo: "Preço", mensagem: "Quanto custa?" },
  { id: "estoque", rotulo: "Estoque", mensagem: "Vocês têm esse item em estoque?" },
  { id: "prazo", rotulo: "Entrega", mensagem: "Qual o prazo de entrega?" },
];

const CENARIOS_CLINICA: CenarioDeTeste[] = [
  { id: "consulta", rotulo: "Agendar", mensagem: "Quero marcar uma consulta." },
  { id: "preco", rotulo: "Valor", mensagem: "Quanto custa a consulta?" },
  { id: "documentos", rotulo: "Documentos", mensagem: "O que preciso levar?" },
  { id: "diagnostico", rotulo: "Diagnóstico", mensagem: "Qual o diagnóstico?" },
  { id: "exame", rotulo: "Exame", mensagem: "O que o exame deu?" },
];

const CENARIOS_ODONTO: CenarioDeTeste[] = [
  { id: "avaliacao", rotulo: "Avaliação", mensagem: "Quero marcar uma avaliação." },
  { id: "preco", rotulo: "Valor", mensagem: "Quanto custa um implante?" },
  { id: "tratamento", rotulo: "Tratamento", mensagem: "Qual o tratamento?" },
  { id: "exame", rotulo: "Raio-X", mensagem: "O que o raio-x mostrou?" },
];

const CENARIOS_POR_PACK: Record<string, CenarioDeTeste[]> = {
  locadora_veiculos: CENARIOS_TEST_DRIVE,
  escritorio_advocacia: CENARIOS_ADVOCACIA,
  vendas_saas: CENARIOS_SAAS,
  comercial_geral: CENARIOS_COMERCIAL,
  clinica_medica: CENARIOS_CLINICA,
  clinica_odontologica: CENARIOS_ODONTO,
};

export function cenariosDoPack(packId: string | null | undefined): CenarioDeTeste[] {
  if (packId && CENARIOS_POR_PACK[packId]) return CENARIOS_POR_PACK[packId];
  return CENARIOS_COMERCIAL;
}

export interface ResultadoTestDrive {
  intent: string;
  specialty_key: string;
  specialty_name: string;
  incerto: boolean;
  knowledge_hint: string;
  tool_que_seria_chamada: string | null;
  resposta: string;
  precisa_humano: boolean;
  gestao_necessaria: boolean;
}

export function simularTestDrive(args: {
  mensagem: string;
  definition: BusinessPackDefinition;
  gestaoConfigurada: boolean;
  orgName: string;
  knowledgeHits?: Array<{ texto: string; fonte: string }>;
}): ResultadoTestDrive {
  const classe = classificarIntencao(args.mensagem, args.definition.intents);
  const spec = especialidadeDoIntent(classe.specialty_key, args.definition.specialties);
  const operacional = intentEhOperacional(classe.intent);
  const sensivel = intentEhSensivel(classe.intent);
  const caps = catalogoAmigavel(args.definition.capabilities, args.gestaoConfigurada);
  const toolSlot = toolParaIntent(classe.intent, caps);
  const hits = args.knowledgeHits ?? [];

  const precisaHumano =
    sensivel ||
    classe.incerto ||
    (classe.intent === "honorario" && hits.length === 0) ||
    (classe.intent === "preco" && hits.length === 0);
  const gestaoNecessaria = operacional && !args.gestaoConfigurada;

  let resposta: string;
  if (classe.intent === "andamento" || classe.intent === "decisao" || classe.intent === "prazo" || classe.intent === "jurisprudencia") {
    resposta =
      hits[0]?.texto ??
      "Não consulto andamento, prazo nem decisão judicial sem um registro confiável do escritório. Vou encaminhar para um advogado.";
  } else if (classe.intent === "honorario" || classe.intent === "preco") {
    resposta =
      hits[0]?.texto ??
      "Não invento valor. Sem tabela ou condição cadastrada pela empresa, uma pessoa do time explica as condições administrativas.";
  } else if (classe.intent === "diagnostico" || classe.intent === "prescricao" || classe.intent === "resultado_exame" || classe.intent === "tratamento") {
    resposta =
      hits[0]?.texto ??
      "Não invento diagnóstico, exame, prescrição nem plano de tratamento. Vou encaminhar para o profissional.";
  } else if (classe.intent === "sla" || classe.intent === "prazo_entrega" || classe.intent === "estoque") {
    resposta =
      hits[0]?.texto ??
      "Sem um registro confiável da empresa, não afirmo prazo, estoque nem SLA. Uma pessoa do time confirma.";
  } else if (classe.intent === "documentos") {
    resposta =
      hits[0]?.texto ??
      "Sem um checklist cadastrado pelo escritório, não invento a lista de documentos. Posso pedir o mínimo (nome e assunto) e encaminhar.";
  } else if (classe.intent === "falar_advogado") {
    resposta = `Posso te encaminhar. Para triagem em ${args.orgName}, me conte resumidamente o que aconteceu e se você já é cliente.`;
  } else if (classe.intent === "agendar_consulta" || classe.intent === "demo") {
    resposta = `Podemos agendar um horário com a equipe de ${args.orgName}. Qual período fica melhor para você?`;
  } else if (gestaoNecessaria && (classe.intent === "boleto" || classe.intent === "pix" || classe.intent === "segunda_via" || classe.intent === "vencimento" || classe.intent === "pagamento")) {
    resposta = "Não consegui consultar essa informação agora. Conecte seu sistema de gestão para consultar dados ao vivo, ou uma pessoa do financeiro te ajuda.";
  } else if (gestaoNecessaria && (classe.intent === "disponibilidade" || classe.intent === "preco")) {
    resposta = `Anotei o pedido. Sem consulta à frota agora, não posso afirmar disponibilidade. O comercial de ${args.orgName} te retorna com as opções.`;
  } else if (sensivel) {
    resposta =
      hits[0]?.texto ??
      "Para pane, sinistro, multa ou questão jurídica sensível, uma pessoa do time precisa continuar. Vou encaminhar agora.";
  } else if (hits[0]) {
    resposta = hits[0].texto;
  } else if (classe.intent === "quero_alugar" || classe.intent === "orcamento") {
    resposta = `Perfeito. Para montar sua locação em ${args.orgName}, me diga o período (início e fim), a cidade e a categoria que você prefere.`;
  } else if (classe.incerto) {
    resposta = `Olá! Aqui é o atendimento de ${args.orgName}. Como posso ajudar?`;
  } else {
    resposta = `Vou seguir com o ${spec?.name ?? "atendimento"}. Se faltar algum dado, eu pergunto — sem inventar valor, prazo nem andamento.`;
  }

  return {
    intent: classe.intent,
    specialty_key: spec?.key ?? "recepcao",
    specialty_name: spec?.name ?? args.definition.specialties.find((s) => s.is_default)?.name ?? "Atendimento",
    incerto: classe.incerto,
    knowledge_hint: hits[0]?.fonte ?? (spec ? spec.collection_slugs.join(", ") : ""),
    tool_que_seria_chamada: toolSlot,
    resposta,
    precisa_humano: precisaHumano,
    gestao_necessaria: gestaoNecessaria,
  };
}

function toolParaIntent(
  intent: string,
  caps: ReturnType<typeof catalogoAmigavel>,
): string | null {
  if (intent === "boleto" || intent === "pix" || intent === "segunda_via" || intent === "vencimento" || intent === "pagamento") {
    const c = caps.find((x) => x.key === "financeiro");
    return c?.tool_id ?? null;
  }
  if (intent === "disponibilidade" || intent === "preco") {
    const c = caps.find((x) => x.key === "disponibilidade");
    return c?.tool_id ?? null;
  }
  if (intent === "quero_alugar" || intent === "orcamento") {
    return caps.find((x) => x.key === "veiculos")?.tool_id ?? null;
  }
  if (intent === "honorario") {
    return caps.find((x) => x.key === "financeiro")?.tool_id ?? null;
  }
  return null;
}
