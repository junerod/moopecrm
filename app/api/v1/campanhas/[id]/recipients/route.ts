import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: camp } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!camp) return fail("not_found", "Campanha não encontrada.", 404, { requestId });

  const { data, error } = await supabase
    .from("campaign_recipients")
    .select(
      "id, contact_id, phone, channel, destination, status, sent_at, delivered_at, read_at, replied_at, failed_at, error, lead_id, message_id",
    )
    .eq("campaign_id", id)
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const rows = (data ?? []) as Array<{ contact_id: string }>;
  const ids = [...new Set(rows.map((r) => r.contact_id))];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data: contatos } = await supabase
      .from("contacts")
      .select("id, display_name, name")
      .eq("organization_id", authz.org.orgId)
      .in("id", ids);
    for (const c of (contatos ?? []) as Array<{ id: string; display_name?: string | null; name?: string | null }>) {
      nomes.set(c.id, c.display_name || c.name || "");
    }
  }
  return ok(
    rows.map((row) => ({
      ...row,
      nome: nomes.get(row.contact_id) || null,
    })),
    { requestId },
  );
}
