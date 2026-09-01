/**
 * O dono declara no pareamento se o chip já atende ou se é novo.
 *
 * Sem esta declaração o motor trata idade 0 (20/dia). Parear no CRM não
 * zera o WhatsApp — só a gente “esquecia” a idade. A pergunta mora no QR;
 * este módulo é o que a rota grava para o pacing ler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { WARMUP_PULADO } from "@/lib/ai/pacing-knobs";

/** Teto do dia para chip que o dono disse que já atende. Cobre 300 locatários + avisos. */
export const TETO_DIARIO_NUMERO_JA_EM_USO = 500;

/** Teto do dia para chip novo — o mesmo default da linha de channel_sessions. */
export const TETO_DIARIO_NUMERO_NOVO = 250;

export const declaracaoDoNumeroSchema = z.object({
  numero_ja_em_uso: z.boolean(),
});

export type DeclaracaoDoNumero = z.infer<typeof declaracaoDoNumeroSchema>;

export type EfeitoDaDeclaracao = {
  warmup_daily_caps: ReadonlyArray<{ minAgeDays: number; cap: number | null }> | null;
  daily_message_limit: number;
};

export function efeitoDaDeclaracao(d: DeclaracaoDoNumero): EfeitoDaDeclaracao {
  if (d.numero_ja_em_uso) {
    return {
      warmup_daily_caps: [...WARMUP_PULADO],
      daily_message_limit: TETO_DIARIO_NUMERO_JA_EM_USO,
    };
  }
  return {
    warmup_daily_caps: null,
    daily_message_limit: TETO_DIARIO_NUMERO_NOVO,
  };
}

export async function gravarDeclaracaoDoNumero(
  db: SupabaseClient,
  orgId: string,
  sessionId: string,
  declaracao: DeclaracaoDoNumero,
): Promise<{ error: Error | null }> {
  const efeito = efeitoDaDeclaracao(declaracao);
  const { error: kErr } = await db.from("channel_knobs").upsert(
    {
      organization_id: orgId,
      channel_session_id: sessionId,
      warmup_daily_caps: efeito.warmup_daily_caps,
    },
    { onConflict: "organization_id,channel_session_id" },
  );
  if (kErr) return { error: new Error(kErr.message) };
  const { error: sErr } = await db
    .from("channel_sessions")
    .update({ daily_message_limit: efeito.daily_message_limit })
    .eq("id", sessionId)
    .eq("organization_id", orgId);
  if (sErr) return { error: new Error(sErr.message) };
  return { error: null };
}
