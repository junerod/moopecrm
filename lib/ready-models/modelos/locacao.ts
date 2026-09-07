import type { ReadyModelDefinition, LocacaoSubtype } from "@/lib/ready-models/tipos";
import { READY_MODEL_VERSION } from "@/lib/ready-models/tipos";

const PIPELINE = {
  nome: "Atendimento",
  etapas: [
    { nome: "Novo contato", passo: "new" as const },
    { nome: "Qualificação", passo: "qualifying" as const },
    { nome: "Cotação / Proposta", passo: "qualified" as const },
    { nome: "Negociação", passo: "negotiating" as const },
    { nome: "Fechamento", passo: "won" as const },
    { nome: "Não fechou", passo: "lost" as const },
  ],
};

const ROTULO_ITEM: Record<LocacaoSubtype, string> = {
  veiculos: "Veículo",
  maquinas_e_equipamentos: "Equipamento",
  ferramentas: "Ferramenta",
  imoveis: "Imóvel",
  outros: "Item",
};

const DESC_SUBTYPE: Record<LocacaoSubtype, string> = {
  veiculos: "Locação de veículos.",
  maquinas_e_equipamentos: "Locação de máquinas e equipamentos, sem operador.",
  ferramentas: "Locação de ferramentas.",
  imoveis: "Locação de imóveis.",
  outros: "Locação de bens.",
};

export function definitionLocacao(subtype?: LocacaoSubtype): ReadyModelDefinition {
  const sub = subtype ?? "outros";
  const rotuloItem = ROTULO_ITEM[sub];
  return {
    id: "locacao",
    version: READY_MODEL_VERSION,
    label: "Locação",
    description: DESC_SUBTYPE[sub],
    subtype: sub,
    pipeline: PIPELINE,
    fields: [
      {
        key: "item_tipo",
        label: rotuloItem,
        type: "text",
      },
      { key: "quantidade", label: "Quantidade", type: "number" },
      { key: "periodo", label: "Período", type: "text" },
      { key: "cidade_local", label: "Cidade / local", type: "text" },
      { key: "necessidade", label: "Necessidade", type: "textarea" },
      { key: "orcamento", label: "Orçamento", type: "text" },
      {
        key: "origem",
        label: "Origem",
        type: "select",
        options: [
          { value: "whatsapp", label: "WhatsApp" },
          { value: "indicacao", label: "Indicação" },
          { value: "site", label: "Site" },
          { value: "outro", label: "Outro" },
        ],
      },
    ],
    canonicalTags: ["novo", "qualificacao", "proposta"],
    lostReasons: [
      "preço",
      "sem disponibilidade",
      "concorrente",
      "sem retorno",
      "desistiu",
      "outro",
    ],
    vocabulary: {
      lead: "Contato",
      deal: "Oportunidade",
      won: "Fechamento",
      lost: "Não fechou",
    },
    automation: {
      name: "rm:locacao:tag-novo",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["novo"] } }],
    },
    followup: {
      name: "rm:locacao:silencio-24h",
      template_name: "rm:locacao:followup-24h",
      template_body:
        "Oi! Vi que conversamos ontem. Ainda posso ajudar com a locação?",
      silence_threshold_minutes: 1440,
    },
    aiDefaults: { ai_mode: "off" },
    copilotOverlay: {
      instruction:
        "Este negócio trabalha com locação de bens. Extraia apenas informações explicitamente informadas. Não invente disponibilidade, preço nem prazo.",
    },
  };
}
