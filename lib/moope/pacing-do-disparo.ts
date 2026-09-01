/**
 * Freio do disparo da locadora — o CRM é dono do número.
 *
 * A locadora pede um envio. Este módulo decide se o WAHA pode falar AGORA.
 * Se não pode, devolve segundos para esperar — o HTTP não dorme.
 * Resposta no Inbox / agente continua no throttle de 1,2s; boleto usa o
 * piso de disparo proativo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { capabilitiesOf } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";
import {
  PACING_DEFAULTS,
  PROACTIVE_THROTTLE_MS,
  type PacingKnobs,
} from "@/lib/agent-engine/pacing/defaults";
import { dayStartInTz, decidePacing } from "@/lib/agent-engine/pacing/engine";
import { parseWarmupCaps } from "@/lib/agent-engine/pacing/store";

export type FreioDoDisparo =
  | { ok: true }
  | { ok: false; retry_after: number; message: string };

export function knobsDoDisparoProativo(base: PacingKnobs): PacingKnobs {
  return {
    ...base,
    throttleMs: Math.max(base.throttleMs, PROACTIVE_THROTTLE_MS),
  };
}

export function decidirDisparo(input: Parameters<typeof decidePacing>[0]): FreioDoDisparo {
  const d = decidePacing({
    ...input,
    knobs: knobsDoDisparoProativo(input.knobs),
  });
  if (!d.allow) {
    const espera = Math.max(1, Math.ceil((d.nextAllowedAt.getTime() - input.now.getTime()) / 1000));
    return { ok: false, retry_after: espera, message: d.reason };
  }
  if (d.waitMs > 0) {
    return {
      ok: false,
      retry_after: Math.max(1, Math.ceil(d.waitMs / 1000)),
      message: "O número ainda está no intervalo de segurança. Espere e mande o próximo.",
    };
  }
  return { ok: true };
}

export async function avaliarDisparoProativo(
  admin: SupabaseClient,
  orgId: string,
  sessionId: string,
  provider: string,
  agora: Date,
): Promise<FreioDoDisparo> {
  const knobs = await lerKnobs(admin, orgId, sessionId);
  const state = await lerEstado(admin, orgId, sessionId, knobs.timezone, agora);
  const { data: sessao } = await admin
    .from("channel_sessions")
    .select("daily_message_limit")
    .eq("id", sessionId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const crmDailyLimit =
    typeof (sessao as { daily_message_limit?: number } | null)?.daily_message_limit === "number"
      ? (sessao as { daily_message_limit: number }).daily_message_limit
      : null;
  const { banRisk } = capabilitiesOf(provider as ChannelProvider);
  return decidirDisparo({
    now: agora,
    knobs,
    state,
    crmDailyLimit,
    banRisk,
    rng: () => 0.5,
  });
}

export async function registrarDisparoNoLedger(
  admin: SupabaseClient,
  orgId: string,
  sessionId: string,
  sentAt: Date,
): Promise<void> {
  await admin.from("pacing_ledger").insert({
    organization_id: orgId,
    channel_session_id: sessionId,
    sent_at: sentAt.toISOString(),
  } as never);
}

export async function lerKnobs(
  admin: SupabaseClient,
  orgId: string,
  sessionId: string,
): Promise<PacingKnobs> {
  const { data } = await admin
    .from("channel_knobs")
    .select(
      "throttle_ms, jitter_max_ms, window_start_hour, window_end_hour, allow_sunday, timezone, warmup_daily_caps, number_activated_at",
    )
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessionId)
    .maybeSingle();
  if (!data) return { ...PACING_DEFAULTS };
  const row = data as {
    throttle_ms: number | null;
    jitter_max_ms: number | null;
    window_start_hour: number | null;
    window_end_hour: number | null;
    allow_sunday: boolean | null;
    timezone: string | null;
    warmup_daily_caps: unknown;
  };
  return {
    throttleMs: row.throttle_ms ?? PACING_DEFAULTS.throttleMs,
    jitterMaxMs: row.jitter_max_ms ?? PACING_DEFAULTS.jitterMaxMs,
    windowStartHour: row.window_start_hour ?? PACING_DEFAULTS.windowStartHour,
    windowEndHour: row.window_end_hour ?? PACING_DEFAULTS.windowEndHour,
    allowSunday: row.allow_sunday ?? PACING_DEFAULTS.allowSunday,
    timezone: row.timezone ?? PACING_DEFAULTS.timezone,
    warmupDailyCaps: parseWarmupCaps(row.warmup_daily_caps) ?? PACING_DEFAULTS.warmupDailyCaps,
  };
}

export async function lerEstado(
  admin: SupabaseClient,
  orgId: string,
  sessionId: string,
  timezone: string,
  agora: Date,
): Promise<{ lastSentAt: Date | null; sentToday: number; numberActivatedAt: Date | null }> {
  const { data: knob } = await admin
    .from("channel_knobs")
    .select("number_activated_at")
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessionId)
    .maybeSingle();
  const ativado = (knob as { number_activated_at?: string | null } | null)?.number_activated_at;
  const dayStart = dayStartInTz(agora, timezone).toISOString();
  const { data: ultimo } = await admin
    .from("pacing_ledger")
    .select("sent_at")
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessionId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count } = await admin
    .from("pacing_ledger")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessionId)
    .gte("sent_at", dayStart);
  return {
    lastSentAt: (ultimo as { sent_at?: string } | null)?.sent_at
      ? new Date((ultimo as { sent_at: string }).sent_at)
      : null,
    sentToday: count ?? 0,
    numberActivatedAt: ativado ? new Date(ativado) : null,
  };
}
