/**
 * Forma do quadro que o Facejus desenha.
 *
 * É o mesmo funil do CRM: etapas na ordem, cards na posição, e o arrasto
 * manda a posição calculada entre os vizinhos. Quem persiste é
 * `funil-quadro-consultar.ts`, nas mesmas tabelas que a tela daqui.
 */
import { z } from "zod";

import { midpoint } from "@/lib/kanban/fractional-indexing";
import { estadoDaProximaAcao, type EstadoDaProximaAcao } from "@/lib/comercial/proxima-acao";
import { TEMPERATURAS_DO_LEAD } from "@/lib/crm/papel-e-temperatura";

export interface EtapaDoQuadro {
  id: string;
  name: string;
  position: number;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
}

export interface PassoDoCard {
  text: string;
  due_at: string | null;
  state: EstadoDaProximaAcao;
}

export interface CardDoQuadro {
  id: string;
  title: string;
  status: string;
  stage_id: string;
  position_in_stage: number;
  value_cents: number | null;
  currency: string | null;
  temperature: "frio" | "morno" | "quente" | null;
  tags: string[];
  updated_at: string;
  created_at: string;
  last_activity_at: string | null;
  hours_in_stage: number | null;
  contact_external_id: string | null;
  contact_name: string | null;
  papel: string | null;
  lost_reason: string | null;
  next_step: PassoDoCard | null;
}

export interface VocabularioDoFunil {
  lead: string;
  won: string;
  lost: string;
}

export interface FunilNaLista {
  id: string;
  name: string;
  is_default: boolean;
  vocabulary: VocabularioDoFunil;
}

const timestampFlexivel = z
  .string()
  .min(10)
  .refine((s) => !Number.isNaN(Date.parse(s)), "expected_updated_at deve ser um timestamp válido");

export const moverCardSchema = z.object({
  stage_id: z.string().uuid(),
  expected_updated_at: timestampFlexivel,
  /** Entre o card de cima e o de baixo. Sem isto, o card vai para o fim da etapa. */
  position_in_stage: z.number().finite().optional(),
});

export const perderCardSchema = z.object({
  lost_reason: z.string().trim().min(1, "Informe o motivo da perda.").max(500),
});

export const proximoPassoSchema = z.object({
  text: z.string().trim().min(2).max(500),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const editarCardSchema = z
  .object({
    expected_updated_at: timestampFlexivel,
    title: z.string().trim().min(2).max(200).optional(),
    value_cents: z.number().int().nonnegative().nullable().optional(),
    temperature: z.enum(TEMPERATURAS_DO_LEAD).nullable().optional(),
  })
  .refine(
    (v) => v.title !== undefined || v.value_cents !== undefined || v.temperature !== undefined,
    "Informe o título, o valor ou a temperatura.",
  );

export function vocabularioDoFunil(raw: unknown): VocabularioDoFunil {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    lead: texto(v.lead) ?? "Negócio",
    won: texto(v.won) ?? "Ganho",
    lost: texto(v.lost) ?? "Perdido",
  };
}

export function horasNoEstagio(
  lastActivityAt: string | null,
  createdAt: string,
  agora = new Date(),
): number | null {
  const referencia = lastActivityAt ?? createdAt;
  const instante = new Date(referencia);
  if (Number.isNaN(instante.getTime())) return null;
  return Math.max(0, (agora.getTime() - instante.getTime()) / 3_600_000);
}

/** O card solto no fim da coluna, a mesma conta do trilho de etapas. */
export function posicaoNoFim(ultima: number | null): number {
  return midpoint(ultima, null);
}

export function temperaturaDoCard(valor: unknown): CardDoQuadro["temperature"] {
  return valor === "frio" || valor === "morno" || valor === "quente" ? valor : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}
