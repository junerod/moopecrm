/**
 * Garante um agente-container inativo para guardar o conhecimento da empresa.
 *
 * Não publica e não envia. O runtime só atende quem tem published_version_id.
 * Sem isto, o leigo que pulou o WhatsApp não conseguia ensinar a empresa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function garantirAgenteDoAcervo(
  admin: SupabaseClient,
  organizationId: string,
  actorUserId: string | null,
): Promise<{ id: string; criou: boolean }> {
  const { data: existente, error: sel } = await admin
    .from("ai_agents")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sel) throw new Error(`ler agente do acervo: ${sel.message}`);
  if (existente) return { id: existente.id as string, criou: false };

  const { data: criado, error: ins } = await admin
    .from("ai_agents")
    .insert({
      organization_id: organizationId,
      name: "Assistente da empresa",
      description: "Guarda o conhecimento da empresa. Nasce inativo.",
      model: "anthropic/claude-sonnet-4-6",
      system_prompt:
        "Você ajuda o atendente com o que a empresa cadastrou. Não invente preço, prazo nem disponibilidade.",
      is_active: false,
      is_default: true,
      kind: "rag_bot",
      created_by: actorUserId,
    } as never)
    .select("id")
    .single();
  if (ins || !criado) throw new Error(`criar agente do acervo: ${ins?.message ?? "sem id"}`);
  return { id: criado.id as string, criou: true };
}
