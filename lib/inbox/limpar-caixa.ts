/**
 * Apaga a caixa de entrada de UMA organização: fila, minhas, IA e fechadas.
 *
 * Contatos e cards do funil ficam. A mídia vai para a fila de remoção ANTES
 * de apagar a conversa — senão o caminho do arquivo some com a mensagem e o
 * anexo fica órfão no bucket. Acompanhamentos ainda vivos param antes, senão
 * continuam escrevendo para gente cuja conversa acabou de sumir.
 *
 * A palavra LIMPAR é a segunda trava. O botão sozinho não basta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CONFIRMACAO_DE_LIMPAR_CAIXA = "LIMPAR";

const LOTE = 200;

/** O que ainda pode disparar mensagem. Terminal (`completed`, `cancelled`, `dead`) fica. */
const ACOMPANHAMENTO_VIVO = [
  "active",
  "waiting_reply",
  "paused_handoff",
  "paused_manual",
] as const;

export interface CaixaLimpa {
  apagadas: number;
  acompanhamentos: number;
  midias: number;
  avisos: number;
}

export async function limparCaixa(
  supabase: SupabaseClient,
  organizationId: string,
  confirmacao: string,
  requestId: string,
): Promise<CaixaLimpa> {
  if (confirmacao.trim() !== CONFIRMACAO_DE_LIMPAR_CAIXA) {
    throw new Error("Digite LIMPAR para limpar a caixa de entrada.");
  }

  const midias = await enfileirarMidias(supabase, organizationId, requestId);
  const acompanhamentos = await pararAcompanhamentos(supabase, organizationId);
  const avisos = await apagarEmLotes(
    supabase,
    "agent_inbox_items",
    organizationId,
    "Não consegui limpar os avisos da caixa.",
  );
  const apagadas = await apagarEmLotes(
    supabase,
    "conversations",
    organizationId,
    "Não consegui limpar a caixa de entrada.",
  );

  return { apagadas, acompanhamentos, midias, avisos };
}

async function enfileirarMidias(
  supabase: SupabaseClient,
  organizationId: string,
  requestId: string,
): Promise<number> {
  let cursor = "";
  let midias = 0;

  for (;;) {
    let consulta = supabase
      .from("messages")
      .select("id, media_storage_path")
      .eq("organization_id", organizationId)
      .not("media_storage_path", "is", null)
      .order("id", { ascending: true });
    if (cursor) consulta = consulta.gt("id", cursor);

    const { data, error } = await consulta.limit(LOTE);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    const ultimo = data[data.length - 1]?.id as string | undefined;
    if (!ultimo || ultimo === cursor) {
      throw new Error("Não consegui separar as mídias da caixa.");
    }
    cursor = ultimo;

    const linhas = data.flatMap((row) => {
      const path = (row as { media_storage_path?: string | null }).media_storage_path;
      if (!path) return [];
      return [
        {
          organization_id: organizationId,
          request_id: requestId,
          bucket: "whatsapp-media",
          object_path: path,
          status: "pending",
          attempts: 0,
          processed_at: null,
          error_message: null,
        },
      ];
    });
    if (linhas.length === 0) continue;

    const { error: upErr } = await supabase
      .from("storage_redaction_queue")
      .upsert(linhas, { onConflict: "bucket,object_path" });
    if (upErr) throw new Error(upErr.message);
    midias += linhas.length;
  }

  return midias;
}

async function pararAcompanhamentos(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const agora = new Date().toISOString();
  let total = 0;
  let ultimo = "";

  for (;;) {
    const { data, error } = await supabase
      .from("followup_enrollments")
      .select("id")
      .eq("organization_id", organizationId)
      .in("status", [...ACOMPANHAMENTO_VIVO])
      .order("id", { ascending: true })
      .limit(LOTE);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    const ids = data.map((r) => r.id as string);
    if (ids[0] === ultimo) {
      throw new Error("Não consegui parar os acompanhamentos.");
    }
    ultimo = ids[0] ?? "";

    const { error: updErr } = await supabase
      .from("followup_enrollments")
      .update({
        status: "cancelled",
        next_eval_at: null,
        claimed_until: null,
        cancel_reason: "caixa_limpa",
        completed_at: agora,
        updated_at: agora,
      })
      .in("id", ids)
      .eq("organization_id", organizationId);
    if (updErr) throw new Error(updErr.message);
    total += ids.length;
  }

  return total;
}

async function apagarEmLotes(
  supabase: SupabaseClient,
  table: "conversations" | "agent_inbox_items",
  organizationId: string,
  falha: string,
): Promise<number> {
  let total = 0;
  let ultimo = "";

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(LOTE);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    const ids = data.map((r) => r.id as string);
    if (ids[0] === ultimo) throw new Error(falha);
    ultimo = ids[0] ?? "";

    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .in("id", ids)
      .eq("organization_id", organizationId);
    if (delErr) throw new Error(delErr.message);
    total += ids.length;
  }

  return total;
}
