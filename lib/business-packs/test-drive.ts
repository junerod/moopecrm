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

  const precisaHumano = sensivel || classe.incerto;
  const gestaoNecessaria = operacional && !args.gestaoConfigurada;
  const hits = args.knowledgeHits ?? [];

  let resposta: string;
  if (gestaoNecessaria && (classe.intent === "boleto" || classe.intent === "pix" || classe.intent === "segunda_via" || classe.intent === "vencimento" || classe.intent === "pagamento")) {
    resposta = "Não consegui consultar essa informação agora. Conecte seu sistema de gestão para consultar dados ao vivo, ou uma pessoa do financeiro te ajuda.";
  } else if (gestaoNecessaria && (classe.intent === "disponibilidade" || classe.intent === "preco")) {
    resposta = `Anotei o pedido. Sem consulta à frota agora, não posso afirmar disponibilidade. O comercial de ${args.orgName} te retorna com as opções.`;
  } else if (sensivel) {
    resposta =
      hits[0]?.texto ??
      "Para pane, sinistro ou multa, uma pessoa do time precisa continuar. Vou encaminhar agora.";
  } else if (hits[0]) {
    resposta = hits[0].texto;
  } else if (classe.intent === "quero_alugar" || classe.intent === "orcamento") {
    resposta = `Perfeito. Para montar sua locação em ${args.orgName}, me diga o período (início e fim), a cidade e a categoria que você prefere.`;
  } else if (classe.incerto) {
    resposta = `Olá! Aqui é o atendimento de ${args.orgName}. Como posso ajudar?`;
  } else {
    resposta = `Vou seguir com o ${spec?.name ?? "atendimento"}. Se faltar algum dado, eu pergunto — sem inventar valor nem disponibilidade.`;
  }

  return {
    intent: classe.intent,
    specialty_key: spec?.key ?? "recepcao",
    specialty_name: spec?.name ?? "Atendimento da Locadora",
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
  return null;
}
