/**
 * Grafo pronto de bot (recepção + horário + FAQ). Draft, não publica sozinho.
 */
import { flowGraphSchema, type FlowGraph } from "@/lib/followup/graph-schema";
import { HORARIO_DENTRO_BRANCH_ID, HORARIO_FORA_BRANCH_ID } from "@/lib/followup/horario";

export const BOT_RECEPCAO_KEY = "bot_recepcao";
export const BOT_RECEPCAO_NOME = "Bot de recepção";

export function grafoBotRecepcao(): FlowGraph {
  const graph = {
    nodes: [
      {
        id: "t1",
        type: "trigger" as const,
        label: "Chegou mensagem",
        position: { x: 0, y: 0 },
        config: {},
      },
      {
        id: "h1",
        type: "horario" as const,
        label: "Horário",
        position: { x: 240, y: 0 },
        config: {},
      },
      {
        id: "m1",
        type: "menu" as const,
        label: "Menu",
        position: { x: 480, y: -80 },
        config: {
          title: "Como posso ajudar?",
          options: [
            { id: "atendimento", number: 1, label: "Atendimento", keywords: ["atendimento"] },
            { id: "comercial", number: 2, label: "Comercial", keywords: ["comercial"] },
            { id: "financeiro", number: 3, label: "Financeiro", keywords: ["financeiro"] },
            { id: "pessoa", number: 4, label: "Falar com alguém", keywords: ["humano", "pessoa"] },
          ],
        },
      },
      {
        id: "f1",
        type: "faq" as const,
        label: "FAQ",
        position: { x: 720, y: -160 },
        config: {
          items: [
            {
              id: "faq_horario",
              keywords: ["horario", "funcionamento", "abre"],
              answer: "Nosso horário de atendimento está configurado no assistente.",
            },
            {
              id: "faq_onde",
              keywords: ["endereco", "onde", "local"],
              answer: "Me diga sua cidade que eu confirmo o ponto mais próximo.",
            },
            {
              id: "faq_pessoa",
              keywords: ["humano", "pessoa", "atendente"],
              answer: "Claro — vou te passar para alguém da equipe.",
            },
          ],
        },
      },
      {
        id: "ia1",
        type: "assistente" as const,
        label: "Assistente",
        position: { x: 720, y: 40 },
        config: {},
      },
      {
        id: "hum1",
        type: "humano" as const,
        label: "Humano",
        position: { x: 720, y: 200 },
        config: { phrase: "Vou te passar para alguém da equipe." },
      },
      {
        id: "hum_fora",
        type: "humano" as const,
        label: "Fora do horário",
        position: { x: 480, y: 200 },
        config: { phrase: "Estamos fora do horário. Uma pessoa retoma assim que possível." },
      },
    ],
    edges: [
      { id: "e_t_h", source: "t1", target: "h1", priority: 0, condition: { type: "always" as const } },
      {
        id: "e_h_in",
        source: "h1",
        target: "m1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: HORARIO_DENTRO_BRANCH_ID },
      },
      {
        id: "e_h_out",
        source: "h1",
        target: "hum_fora",
        priority: 0,
        condition: { type: "branch" as const, branch_id: HORARIO_FORA_BRANCH_ID },
      },
      {
        id: "e_m_1",
        source: "m1",
        target: "f1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "atendimento" },
      },
      {
        id: "e_m_2",
        source: "m1",
        target: "ia1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "comercial" },
      },
      {
        id: "e_m_3",
        source: "m1",
        target: "f1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "financeiro" },
      },
      {
        id: "e_m_4",
        source: "m1",
        target: "hum1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "pessoa" },
      },
      { id: "e_m_else", source: "m1", target: "hum1", priority: 0, condition: { type: "always" as const } },
      {
        id: "e_f_1",
        source: "f1",
        target: "ia1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "faq_horario" },
      },
      {
        id: "e_f_2",
        source: "f1",
        target: "ia1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "faq_onde" },
      },
      {
        id: "e_f_3",
        source: "f1",
        target: "hum1",
        priority: 0,
        condition: { type: "branch" as const, branch_id: "faq_pessoa" },
      },
      { id: "e_f_else", source: "f1", target: "hum1", priority: 0, condition: { type: "always" as const } },
    ],
  };
  return flowGraphSchema.parse(graph);
}
