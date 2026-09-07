import type { ReadyModelDefinition } from "@/lib/ready-models/tipos";
import { READY_MODEL_VERSION } from "@/lib/ready-models/tipos";

export const DEFINITION_PERSONALIZADO: ReadyModelDefinition = {
  id: "personalizado",
  version: READY_MODEL_VERSION,
  label: "Personalizado",
  description: "Configure o quadro do seu jeito.",
  pipeline: {
    nome: "Clientes",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Entendendo a necessidade", passo: "qualifying" },
      { nome: "Proposta enviada", passo: "qualified" },
      { nome: "Negociando", passo: "negotiating" },
      { nome: "Fechou", passo: "won" },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: [],
  canonicalTags: ["novo"],
  lostReasons: ["sem retorno", "desistiu", "outro"],
  vocabulary: {
    lead: "Contato",
    deal: "Negócio",
    won: "Fechou",
    lost: "Não fechou",
  },
  followup: {
    name: "rm:personalizado:silencio-24h",
    template_name: "rm:personalizado:followup-24h",
    template_body: "Oi! Ainda posso ajudar com o que conversamos?",
    silence_threshold_minutes: 1440,
  },
  aiDefaults: { ai_mode: "off" },
  copilotOverlay: {
    instruction:
      "Resuma só o que a conversa disse. Extraia apenas campos conhecidos do funil. Não invente.",
  },
};
