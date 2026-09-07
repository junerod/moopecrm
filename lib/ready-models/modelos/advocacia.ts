import type { ReadyModelDefinition } from "@/lib/ready-models/tipos";
import { READY_MODEL_VERSION } from "@/lib/ready-models/tipos";

export const DEFINITION_ADVOCACIA: ReadyModelDefinition = {
  id: "advocacia",
  version: READY_MODEL_VERSION,
  label: "Escritório de advocacia",
  description: "Triagem e organização de novos contatos. Sem aconselhamento jurídico automático.",
  pipeline: {
    nome: "Novos clientes",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Triagem", passo: "contacted" },
      { nome: "Documentação", passo: "qualifying" },
      { nome: "Análise", passo: "qualified" },
      { nome: "Reunião", passo: "negotiating" },
      { nome: "Contratação", passo: "won" },
      { nome: "Não contratou", passo: "lost" },
    ],
  },
  fields: [
    {
      key: "area_juridica",
      label: "Área jurídica",
      type: "select",
      options: [
        { value: "trabalhista", label: "Trabalhista" },
        { value: "civel", label: "Cível" },
        { value: "familia", label: "Família" },
        { value: "criminal", label: "Criminal" },
        { value: "tributario", label: "Tributário" },
        { value: "consumidor", label: "Consumidor" },
        { value: "previdenciario", label: "Previdenciário" },
        { value: "outro", label: "Outra área" },
      ],
    },
    { key: "tipo_demanda", label: "Tipo de demanda", type: "text" },
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
    { key: "documentacao", label: "Documentação", type: "textarea" },
  ],
  canonicalTags: ["urgente", "triagem", "documentos"],
  lostReasons: [
    "não aderente",
    "sem retorno",
    "não contratou",
    "documentação",
    "outro",
  ],
  vocabulary: {
    lead: "Cliente",
    deal: "Caso",
    won: "Contratou",
    lost: "Não contratou",
  },
  automation: {
    name: "rm:advocacia:tag-novo",
    trigger_event: "lead.created",
    actions: [{ type: "add_tag", config: { tags: ["triagem"] } }],
  },
  followup: {
    name: "rm:advocacia:silencio-24h",
    template_name: "rm:advocacia:followup-24h",
    template_body:
      "Oi! Passando para saber se ainda precisa de ajuda com o que conversamos.",
    silence_threshold_minutes: 1440,
  },
  aiDefaults: { ai_mode: "off" },
  copilotOverlay: {
    instruction:
      "Faça triagem administrativa e comercial. Não forneça aconselhamento jurídico nem prometa resultado.",
  },
};
