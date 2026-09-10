/**
 * Nomes que o usuário lê — nunca o enum cru.
 *
 * AI_MODE continua sendo off/copilot/controlled/autonomous no banco.
 * Ready Model continua sendo o id copiado no tenant.
 */
import type { AiMode } from "@/lib/schemas/settings";
import {
  ROTULOS_SUBTYPE_LOCACAO,
  catalogoParaWizard,
} from "@/lib/ready-models/catalogo";
import type { ReadyModelId, ReadyModelSubtype } from "@/lib/ready-models/tipos";

export const ROTULO_DO_MODO_IA: Record<AiMode, { titulo: string; corpo: string }> = {
  off: {
    titulo: "Desligada",
    corpo: "A IA não participa do atendimento.",
  },
  copilot: {
    titulo: "Assistente",
    corpo: "A IA lê a conversa e sugere respostas. Você decide o que enviar.",
  },
  controlled: {
    titulo: "Controlada",
    corpo: "A IA pode executar ações permitidas, com confirmação quando necessário.",
  },
  autonomous: {
    titulo: "Automática",
    corpo: "A IA pode responder e executar ações autorizadas automaticamente.",
  },
};

export function rotuloDoModoIa(modo: AiMode | string | null | undefined): string {
  if (modo && modo in ROTULO_DO_MODO_IA) {
    return ROTULO_DO_MODO_IA[modo as AiMode].titulo;
  }
  return "Desligada";
}

export function rotuloDoModelo(id: ReadyModelId | string | null | undefined): string {
  if (!id) return "Não definido";
  const item = catalogoParaWizard().find((m) => m.id === id);
  return item?.label ?? "Personalizado";
}

export function rotuloDoSubtipo(
  id: ReadyModelId | string | null | undefined,
  subtype: ReadyModelSubtype | string | null | undefined,
): string | null {
  if (id !== "locacao" || !subtype) return null;
  return ROTULOS_SUBTYPE_LOCACAO[subtype as keyof typeof ROTULOS_SUBTYPE_LOCACAO] ?? subtype;
}
