/**
 * Saída estruturada do Copilot. Categorias genéricas — nicho (MOOPE etc.)
 * entra depois, sem mudar o envelope.
 */
import { z } from "zod";

export const COPILOT_INTENTS = [
  "PRICE",
  "PRODUCT_INFO",
  "DEMO",
  "SUPPORT",
  "COMPLAINT",
  "PAYMENT",
  "HUMAN_REQUEST",
  "FOLLOW_UP",
  "OTHER",
] as const;
export type CopilotIntent = (typeof COPILOT_INTENTS)[number];

export const copilotIntentSchema = z.enum(COPILOT_INTENTS);

export const copilotSuggestionSchema = z.object({
  summary: z.string().min(1).max(2000),
  intent: copilotIntentSchema,
  suggestedReply: z.string().max(4000).default(""),
  suggestedNextAction: z.string().max(500).nullable().default(null),
  extractedFields: z.record(z.string(), z.string()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type CopilotSuggestion = z.infer<typeof copilotSuggestionSchema>;

export type CopilotSuggestionStatus = "ready" | "discarded" | "used";

export function faixaDeConfianca(n: number): "alta" | "media" | "baixa" {
  if (n >= 0.75) return "alta";
  if (n >= 0.4) return "media";
  return "baixa";
}

export function rotuloDaIntencao(intent: CopilotIntent): string {
  switch (intent) {
    case "PRICE":
      return "Preço";
    case "PRODUCT_INFO":
      return "Informação do produto";
    case "DEMO":
      return "Demonstração";
    case "SUPPORT":
      return "Suporte";
    case "COMPLAINT":
      return "Reclamação";
    case "PAYMENT":
      return "Pagamento";
    case "HUMAN_REQUEST":
      return "Pediu um humano";
    case "FOLLOW_UP":
      return "Acompanhamento";
    default:
      return "Outro";
  }
}
