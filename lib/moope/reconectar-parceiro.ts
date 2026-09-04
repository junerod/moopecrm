/**
 * Religar o WhatsApp da locadora. Só modo suave (stop+start).
 * FAILED / QR: humano no CRM. Watchdog da locadora não força logout.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { getWahaClient, wahaFriendlyError } from "@/lib/waha/client";

export type ReconectarParceiroOut =
  | { ok: true; status: string; skipped?: "already_working" | "starting" }
  | { ok: false; motivo: string; error: string };

export async function reconectarCanalDoParceiro(
  admin: SupabaseClient,
  orgId: string,
): Promise<ReconectarParceiroOut> {
  const sessao = await acharSessaoWaha(admin, orgId);
  if (!sessao) {
    return { ok: false, motivo: "sem_canal", error: "Nenhum WhatsApp pareado nesta conta." };
  }
  const st = String(sessao.status || "").toUpperCase();
  if (st === "WORKING") return { ok: true, status: "WORKING", skipped: "already_working" };
  if (st === "STARTING") return { ok: true, status: "STARTING", skipped: "starting" };
  if (st === "FAILED" || st === "SCAN_QR_CODE") {
    return {
      ok: false,
      motivo: "precisa_qr",
      error: "O celular desconectou. Abra o CRM e pareie o WhatsApp de novo.",
    };
  }
  if (st !== "STOPPED") {
    return { ok: false, motivo: "status", error: `Sessão em ${st || "estado desconhecido"}.` };
  }

  const waha = getWahaClient();
  if (!waha) {
    return { ok: false, motivo: "waha", error: "WhatsApp (WAHA) não está configurado no CRM." };
  }
  try {
    await waha.stopSession(sessao.nome);
    const remote = (await waha.startSession(sessao.nome)) as { status?: string };
    const nextStatus = remote.status ?? "STARTING";
    await admin
      .from("channel_sessions")
      .update({
        status: "STARTING",
        last_status_change_at: new Date().toISOString(),
        consecutive_health_fails: 0,
      })
      .eq("organization_id", orgId)
      .eq("id", sessao.id);
    return { ok: true, status: nextStatus };
  } catch (err) {
    return { ok: false, motivo: "waha_error", error: wahaFriendlyError(err) };
  }
}

async function acharSessaoWaha(
  admin: SupabaseClient,
  orgId: string,
): Promise<{ id: string; nome: string; status: string } | null> {
  const { data } = await queryTolerantToMissingArchived(
    () =>
      admin
        .from("channel_sessions")
        .select("id, status, waha_session_name, archived_at")
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .not("waha_session_name", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    () =>
      admin
        .from("channel_sessions")
        .select("id, status, waha_session_name")
        .eq("organization_id", orgId)
        .not("waha_session_name", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  );
  const row = data as { id?: string; status?: string; waha_session_name?: string | null } | null;
  if (!row?.id || !row.waha_session_name) return null;
  return { id: row.id, nome: row.waha_session_name, status: String(row.status || "") };
}
