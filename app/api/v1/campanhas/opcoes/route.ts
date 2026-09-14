/**
 * GET /api/v1/campanhas/opcoes — filtros reais + disponibilidade de canal.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { campanhaComercialRealPermitida } from "@/lib/campanhas/capabilities";
import { diagnosticoDeDispatch } from "@/lib/campanhas/diagnostico";
import { rotuloDisponibilidadeEmail, rotuloDisponibilidadeWhatsapp } from "@/lib/campanhas/canais";
import { isEmailConfigured } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";
import type { ChannelProvider } from "@/lib/channels/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();

  const [{ data: contatos }, { data: membros }, { data: funis }, { data: sessoes }, { data: oficiais }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("tags, papel, source")
        .eq("organization_id", authz.org.orgId)
        .eq("is_anonymized", false)
        .is("is_merged_into", null)
        .limit(2000),
      supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", authz.org.orgId)
        .limit(80),
      supabase
        .from("crm_pipelines")
        .select("id, name, crm_stages(id, name, position)")
        .eq("organization_id", authz.org.orgId)
        .limit(40),
      supabase
        .from("channel_sessions")
        .select("id, provider, display_name, status")
        .eq("organization_id", authz.org.orgId)
        .limit(20),
      supabase
        .from("meta_templates")
        .select("id, name, language, status")
        .eq("organization_id", authz.org.orgId)
        .limit(50),
    ]);

  const tags = new Set<string>();
  const papeis = new Set<string>();
  const origens = new Set<string>();
  for (const c of (contatos ?? []) as Array<{ tags?: string[] | null; papel?: string | null; source?: string | null }>) {
    for (const t of c.tags ?? []) if (t) tags.add(t);
    if (c.papel) papeis.add(c.papel);
    if (c.source) origens.add(c.source);
  }

  const sessoesOk = ((sessoes ?? []) as Array<{
    id: string;
    provider: string;
    display_name?: string | null;
    status?: string | null;
  }>).filter((s) => campanhaComercialRealPermitida(s.provider as ChannelProvider));

  const emailOk = isEmailConfigured();
  const diag = diagnosticoDeDispatch({
    provider: (sessoesOk[0]?.provider as ChannelProvider | undefined) ?? null,
    adapterConfigured: sessoesOk.length > 0,
  });

  return ok(
    {
      tags: [...tags].sort(),
      papeis: [...papeis].sort(),
      origens: [...origens].sort(),
      responsaveis: ((membros ?? []) as Array<{ user_id: string; role: string }>).map((m) => ({
        id: m.user_id,
        role: m.role,
      })),
      funis: funis ?? [],
      sessoes: sessoesOk.map((s) => ({
        id: s.id,
        rotulo: s.display_name || "WhatsApp oficial",
        provider: s.provider,
      })),
      templates_oficiais: ((oficiais ?? []) as Array<{ id: string; name: string; language: string; status: string }>)
        .filter((t) => t.status === "APPROVED" || t.status === "approved")
        .map((t) => ({ id: t.id, name: t.name, language: t.language })),
      whatsapp: {
        conectado: sessoesOk.length > 0,
        rotulo: rotuloDisponibilidadeWhatsapp(sessoesOk.length > 0),
      },
      email: {
        configurado: emailOk,
        rotulo: rotuloDisponibilidadeEmail(emailOk),
      },
      dispatch: diag,
    },
    { requestId },
  );
}
