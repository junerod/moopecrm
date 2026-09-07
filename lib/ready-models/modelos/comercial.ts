import type { ReadyModelDefinition } from "@/lib/ready-models/tipos";
import { READY_MODEL_VERSION } from "@/lib/ready-models/tipos";

export const DEFINITION_COMERCIAL: ReadyModelDefinition = {
  id: "comercial",
  version: READY_MODEL_VERSION,
  label: "Comercial / Vendas",
  description: "Empresas que vendem produtos ou serviços.",
  pipeline: {
    nome: "Vendas",
    etapas: [
      { nome: "Novo lead", passo: "new" },
      { nome: "Qualificação", passo: "qualifying" },
      { nome: "Proposta", passo: "qualified" },
      { nome: "Negociação", passo: "negotiating" },
      { nome: "Fechamento", passo: "won" },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: [
    { key: "produto_servico", label: "Produto / serviço", type: "text" },
    { key: "orcamento", label: "Orçamento", type: "text" },
    {
      key: "origem",
      label: "Origem",
      type: "select",
      options: [
        { value: "whatsapp", label: "WhatsApp" },
        { value: "indicacao", label: "Indicação" },
        { value: "anuncio", label: "Anúncio" },
        { value: "outro", label: "Outro" },
      ],
    },
    {
      key: "tamanho_empresa",
      label: "Tamanho da empresa",
      type: "select",
      options: [
        { value: "mei", label: "MEI / autônomo" },
        { value: "pequena", label: "Pequena" },
        { value: "media", label: "Média" },
        { value: "grande", label: "Grande" },
      ],
    },
  ],
  canonicalTags: ["novo", "proposta"],
  lostReasons: ["preço", "concorrente", "sem retorno", "desistiu", "outro"],
  vocabulary: {
    lead: "Lead",
    deal: "Negócio",
    won: "Fechamento",
    lost: "Não fechou",
  },
  automation: {
    name: "rm:comercial:tag-novo",
    trigger_event: "lead.created",
    actions: [{ type: "add_tag", config: { tags: ["novo"] } }],
  },
  followup: {
    name: "rm:comercial:silencio-24h",
    template_name: "rm:comercial:followup-24h",
    template_body: "Oi! Ainda tem interesse no que conversamos?",
    silence_threshold_minutes: 1440,
  },
  aiDefaults: { ai_mode: "off" },
  copilotOverlay: {
    instruction:
      "Este negócio vende produtos ou serviços. Extraia apenas o que a pessoa disse. Não invente preço nem prazo.",
  },
};
