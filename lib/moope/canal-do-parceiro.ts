/**
 * Retrato do número para a locadora — ela lê, não adivinha o aquecimento.
 *
 * O CRM continua sendo o freio no /send. Isto só responde: posso mandar agora?
 * quantos cabem hoje? o chip está aquecendo?
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { janelaDeEnvioAberta, warmupCapFor } from "@/lib/agent-engine/pacing/engine";
import {
  PACING_DEFAULTS,
  PROACTIVE_THROTTLE_MS,
  type PacingKnobs,
} from "@/lib/agent-engine/pacing/defaults";
import {
  idadeEmDias,
  warmupEstaPulado,
  type ChannelKnobsRow,
} from "@/lib/ai/pacing-knobs";
import { queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { capabilitiesOf } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";
import {
  decidirDisparo,
  knobsDoDisparoProativo,
  lerEstado,
  lerKnobs,
} from "@/lib/moope/pacing-do-disparo";

export type FaseDoCanal = "no_channel" | "warming" | "ready";

export type RetratoDoCanal = {
  ready: boolean;
  phase: FaseDoCanal;
  status: string | null;
  warmup: {
    skipped: boolean;
    age_days: number;
    cap_today: number | null;
    sent_today: number;
    remaining_today: number | null;
  };
  daily_limit: number | null;
  window: {
    start_hour: number;
    end_hour: number;
    timezone: string;
    allow_sunday: boolean;
    open: boolean;
  };
  proactive_gap_seconds: number;
  can_send_now: boolean;
  retry_after: number | null;
};

export function montarRetratoDoCanal(input: {
  status: string | null;
  knobs: PacingKnobs;
  knobsRow: ChannelKnobsRow | null;
  sentToday: number;
  numberActivatedAt: Date | null;
  lastSentAt: Date | null;
  dailyLimit: number | null;
  banRisk: boolean;
  agora: Date;
}): RetratoDoCanal {
  const knobs = knobsDoDisparoProativo(input.knobs);
  const skipped = warmupEstaPulado(input.knobsRow);
  const ageDays = idadeEmDias(
    {
      ...(input.knobsRow ?? {
        throttle_ms: null,
        jitter_max_ms: null,
        window_start_hour: null,
        window_end_hour: null,
        allow_sunday: null,
        timezone: null,
        warmup_daily_caps: null,
      }),
      number_activated_at: input.numberActivatedAt?.toISOString() ?? input.knobsRow?.number_activated_at,
    },
    input.agora,
  );
  const capToday = warmupCapFor(ageDays, knobs.warmupDailyCaps);
  const teto =
    capToday === null && input.dailyLimit === null
      ? null
      : Math.min(capToday ?? Infinity, input.dailyLimit ?? Infinity);
  const remaining = teto === null || !Number.isFinite(teto) ? null : Math.max(0, teto - input.sentToday);

  if (!input.status) {
    return {
      ready: false,
      phase: "no_channel",
      status: null,
      warmup: {
        skipped: false,
        age_days: 0,
        cap_today: null,
        sent_today: 0,
        remaining_today: 0,
      },
      daily_limit: null,
      window: {
        start_hour: knobs.windowStartHour,
        end_hour: knobs.windowEndHour,
        timezone: knobs.timezone,
        allow_sunday: knobs.allowSunday,
        open: janelaDeEnvioAberta(input.agora, knobs),
      },
      proactive_gap_seconds: Math.ceil(Math.max(knobs.throttleMs, PROACTIVE_THROTTLE_MS) / 1000),
      can_send_now: false,
      retry_after: null,
    };
  }

  const phase: FaseDoCanal =
    capToday !== null && !skipped ? "warming" : "ready";

  const freio = decidirDisparo({
    now: input.agora,
    knobs: input.knobs,
    state: {
      lastSentAt: input.lastSentAt,
      sentToday: input.sentToday,
      numberActivatedAt: input.numberActivatedAt,
    },
    crmDailyLimit: input.dailyLimit,
    banRisk: input.banRisk,
    rng: () => 0.5,
  });

  return {
    ready: phase === "ready",
    phase,
    status: input.status,
    warmup: {
      skipped,
      age_days: ageDays,
      cap_today: capToday,
      sent_today: input.sentToday,
      remaining_today: remaining,
    },
    daily_limit: input.dailyLimit,
    window: {
      start_hour: knobs.windowStartHour,
      end_hour: knobs.windowEndHour,
      timezone: knobs.timezone,
      allow_sunday: knobs.allowSunday,
      open: janelaDeEnvioAberta(input.agora, knobs),
    },
    proactive_gap_seconds: Math.ceil(Math.max(knobs.throttleMs, PROACTIVE_THROTTLE_MS) / 1000),
    can_send_now: freio.ok,
    retry_after: freio.ok ? null : freio.retry_after,
  };
}

export async function retratoDoCanalDaOrg(
  admin: SupabaseClient,
  orgId: string,
  agora: Date = new Date(),
): Promise<RetratoDoCanal> {
  const sessao = await acharSessaoWorking(admin, orgId);
  if (!sessao) {
    return montarRetratoDoCanal({
      status: null,
      knobs: PACING_DEFAULTS,
      knobsRow: null,
      sentToday: 0,
      numberActivatedAt: null,
      lastSentAt: null,
      dailyLimit: null,
      banRisk: true,
      agora,
    });
  }

  const knobs = await lerKnobs(admin, orgId, sessao.id);
  const estado = await lerEstado(admin, orgId, sessao.id, knobs.timezone, agora);
  const { data: knobRow } = await admin
    .from("channel_knobs")
    .select(
      "throttle_ms, jitter_max_ms, window_start_hour, window_end_hour, allow_sunday, timezone, warmup_daily_caps, number_activated_at",
    )
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessao.id)
    .maybeSingle();
  const { banRisk } = capabilitiesOf(sessao.provider as ChannelProvider);

  return montarRetratoDoCanal({
    status: sessao.status,
    knobs,
    knobsRow: (knobRow as ChannelKnobsRow | null) ?? null,
    sentToday: estado.sentToday,
    numberActivatedAt: estado.numberActivatedAt,
    lastSentAt: estado.lastSentAt,
    dailyLimit: sessao.daily_message_limit,
    banRisk,
    agora,
  });
}

async function acharSessaoWorking(
  admin: SupabaseClient,
  orgId: string,
): Promise<{
  id: string;
  provider: string;
  status: string;
  daily_message_limit: number | null;
} | null> {
  const { data } = await queryTolerantToMissingArchived(
    () =>
      admin
        .from("channel_sessions")
        .select("id, provider, status, daily_message_limit, archived_at")
        .eq("organization_id", orgId)
        .eq("status", "WORKING")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    () =>
      admin
        .from("channel_sessions")
        .select("id, provider, status, daily_message_limit")
        .eq("organization_id", orgId)
        .eq("status", "WORKING")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  );
  return (data as {
    id: string;
    provider: string;
    status: string;
    daily_message_limit: number | null;
  } | null) ?? null;
}
