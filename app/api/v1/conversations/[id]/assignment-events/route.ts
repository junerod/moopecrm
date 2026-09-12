/**
 * GET /api/v1/conversations/[id]/assignment-events
 *
 * Lê `conversation_assignment_events` da conversa — sem tabela nova.
 * Confirma a conversa na org ativa (client do request + RLS) antes de listar,
 * para devolver 404 em vez de vazar existência cross-org.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { nomesDosAtendentes } from "@/lib/users/nome-do-atendente";

export const dynamic = "force-dynamic";

const COLS = "id, conversation_id, from_user_id, to_user_id, changed_by, reason, created_at";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversation_assignment_events" });
  if (!authz.ok) return authz.response;
  const { org } = authz;
  const { id } = await params;

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  if (!conversation) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  const { data, error } = await supabase
    .from("conversation_assignment_events")
    .select(COLS)
    .eq("conversation_id", id)
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", "Erro ao listar o histórico de atendimento.", 500, { requestId });

  const rows = data ?? [];
  const nomes = await nomesDosAtendentes(
    rows.flatMap((r) => [r.from_user_id, r.to_user_id, r.changed_by]),
  );

  return ok(
    rows.map((r) => ({
      ...r,
      from_user_name: r.from_user_id ? (nomes.get(r.from_user_id) ?? null) : null,
      to_user_name: r.to_user_id ? (nomes.get(r.to_user_id) ?? null) : null,
      changed_by_name: r.changed_by ? (nomes.get(r.changed_by) ?? null) : null,
    })),
    { requestId },
  );
}
