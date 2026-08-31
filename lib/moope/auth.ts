/**
 * Resolve a conexão MOOPE a partir do Bearer de entrada.
 *
 * A org NUNCA sai do body — sai do hash da chave, que o banco guarda.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chaveBate, extrairBearer } from "@/lib/moope/chave";
import type { MoopeConnectionRow } from "@/lib/moope/tipos";

export async function resolverConexaoPeloBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<MoopeConnectionRow | null> {
  const plaintext = extrairBearer(authHeader);
  if (!plaintext || !plaintext.startsWith("mop_")) return null;

  const prefix = plaintext.split("_").slice(0, 2).join("_");
  const { data, error } = await admin
    .from("moope_connections")
    .select(
      "id, organization_id, kind, partner_webhook_url, inbound_key_prefix, inbound_key_hash, outbound_secret_enc, status",
    )
    .eq("inbound_key_prefix", prefix)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as MoopeConnectionRow;
  if (!chaveBate(plaintext, row.inbound_key_hash)) return null;
  return row;
}

export async function emailEMembro(
  admin: SupabaseClient,
  orgId: string,
  email: string,
): Promise<{ userId: string; email: string } | null> {
  const normalizado = email.trim().toLowerCase();
  if (!normalizado) return null;

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === normalizado);
  if (!user) return null;

  const { data: membro } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!membro) return null;
  return { userId: user.id, email: normalizado };
}
