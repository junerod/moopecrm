import type { ReadyModelDefinition } from "@/lib/ready-models/tipos";
import { READY_MODEL_VERSION } from "@/lib/ready-models/tipos";

export const DEFINITION_SERVICOS: ReadyModelDefinition = {
  id: "servicos",
  version: READY_MODEL_VERSION,
  label: "Prestação de serviços",
  description: "Prestadores que orçam e executam.",
  pipeline: {
    nome: "Orçamentos",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Entendimento", passo: "qualifying" },
      { nome: "Orçamento", passo: "qualified" },
      { nome: "Agendamento / Execução", passo: "negotiating" },
      { nome: "Fechamento", passo: "won" },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: [
    { key: "tipo_servico", label: "Tipo de serviço", type: "text" },
    { key: "cidade", label: "Cidade", type: "text" },
    {
      key: "urgencia",
      label: "Urgência",
      type: "select",
      options: [
        { value: "baixa", label: "Baixa" },
        { value: "media", label: "Média" },
        { value: "alta", label: "Alta" },
      ],
    },
  ],
  canonicalTags: ["novo", "orcamento"],
  lostReasons: ["preço", "desistiu", "sem retorno", "outro"],
  vocabulary: {
    lead: "Contato",
    deal: "Serviço",
    won: "Fechamento",
    lost: "Não fechou",
  },
  automation: {
    name: "rm:servicos:tag-novo",
    trigger_event: "lead.created",
    actions: [{ type: "add_tag", config: { tags: ["novo"] } }],
  },
  followup: {
    name: "rm:servicos:silencio-24h",
    template_name: "rm:servicos:followup-24h",
    template_body: "Oi! Conseguiu ver o orçamento que combinamos?",
    silence_threshold_minutes: 1440,
  },
  aiDefaults: { ai_mode: "off" },
  copilotOverlay: {
    instruction:
      "Este negócio presta serviços. Extraia tipo de serviço, cidade e urgência só se a pessoa informou.",
  },
};
