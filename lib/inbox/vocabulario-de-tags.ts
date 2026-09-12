import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalConversationTagsSchema } from "@/lib/schemas/settings";

const TETO = 50;

/**
 * Junta o vocabulário oficial com o que a operação já usa.
 *
 * Oficial sozinho esconde "plataforma" / "rastreamento" que o time inventou
 * ontem. Só o uso esconde a tag canônica que ninguém aplicou ainda. As duas
 * fontes juntas é o que deixa a próxima conversa reaproveitar a tag, sem
 * segundo catálogo nem escrita em `canonical_conversation_tags`.
 */
export function ordenarVocabulario(
  contagem: Map<string, number>,
  oficiais: readonly string[] = [],
  teto = TETO,
): string[] {
  const mapa = new Map(contagem);
  for (const oficial of oficiais) {
    const n = oficial.trim().toLowerCase();
    if (n && !mapa.has(n)) mapa.set(n, 0);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t)
    .slice(0, teto);
}

export function contarTags(linhas: Array<{ tags: string[] | null } | null>): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    for (const bruto of linha?.tags ?? []) {
      const t = bruto.trim().toLowerCase();
      if (!t) continue;
      contagem.set(t, (contagem.get(t) ?? 0) + 1);
    }
  }
  return contagem;
}

export async function vocabularioDeTagsDeConversa(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr) throw orgErr;

  const oficiais = canonicalConversationTagsSchema.parse(
    (org?.settings as Record<string, unknown> | null)?.["canonical_conversation_tags"] ?? [],
  );

  const { data: conversas, error: convErr } = await supabase
    .from("conversations")
    .select("tags")
    .eq("organization_id", organizationId)
    .limit(2000);
  if (convErr) throw convErr;

  return ordenarVocabulario(
    contarTags((conversas ?? []) as Array<{ tags: string[] | null }>),
    oficiais,
  );
}

export async function vocabularioDeTagsDeContato(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("tags")
    .eq("organization_id", organizationId)
    .limit(2000);
  if (error) throw error;

  return ordenarVocabulario(contarTags((data ?? []) as Array<{ tags: string[] | null }>));
}
