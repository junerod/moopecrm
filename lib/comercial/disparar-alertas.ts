import type { SupabaseClient } from "@supabase/supabase-js";

import {
  chaveDeIdempotencia,
  elegivelParaAlerta,
  type AntecedenciaMin,
  type KindDeAlerta,
} from "@/lib/comercial/alerta-interno";
import { enviarAlertaInternoMock, type EntregaDeAlertaInterno } from "@/lib/comercial/enviar-alerta-interno";

const KINDS: KindDeAlerta[] = ["pre_due", "overdue"];

export async function varrerAlertasDeProximasAcoes(
  admin: SupabaseClient,
  agora: Date = new Date(),
): Promise<{ enviados: number; pulados: number; entregas: EntregaDeAlertaInterno[] }> {
  const { data: acoes, error } = await admin
    .from("demandas")
    .select("id, organization_id, proximo_passo, proximo_passo_em, dono_user_id, contact_id")
    .is("fechada_em", null)
    .not("proximo_passo", "is", null)
    .not("proximo_passo_em", "is", null)
    .eq("dono_kind", "humano")
    .not("dono_user_id", "is", null)
    .limit(400);
  if (error) throw new Error(error.message);

  const entregas: EntregaDeAlertaInterno[] = [];
  let pulados = 0;

  for (const row of acoes ?? []) {
    const orgId = row.organization_id as string;
    const dono = row.dono_user_id as string;
    const { data: prefs } = await admin
      .from("user_organizations")
      .select("alert_whatsapp_phone, alert_proxima_acao, alert_antecedencia_min")
      .eq("organization_id", orgId)
      .eq("user_id", dono)
      .is("revoked_at", null)
      .maybeSingle();

    const { data: contato } = await admin
      .from("contacts")
      .select("display_name, phone_number")
      .eq("id", row.contact_id as string)
      .eq("organization_id", orgId)
      .maybeSingle();

    const antecedencia = ([10, 30, 60] as const).includes(
      (prefs?.alert_antecedencia_min as number) as AntecedenciaMin,
    )
      ? ((prefs?.alert_antecedencia_min as AntecedenciaMin) ?? 30)
      : 30;

    for (const kind of KINDS) {
      const chave = chaveDeIdempotencia({
        demandaId: row.id as string,
        kind,
        dueAt: row.proximo_passo_em as string,
      });
      const scheduledFor = chave.split(":").slice(2).join(":");

      const { data: ja } = await admin
        .from("demanda_alert_deliveries")
        .select("id")
        .eq("organization_id", orgId)
        .eq("demanda_id", row.id as string)
        .eq("kind", kind)
        .eq("scheduled_for", scheduledFor)
        .maybeSingle();

      const elegivel = elegivelParaAlerta({
        acao: {
          demandaId: row.id as string,
          organizationId: orgId,
          texto: (row.proximo_passo as string) ?? "",
          em: row.proximo_passo_em as string,
          donoUserId: dono,
          contactName: (contato?.display_name as string | null)?.trim() || "Contato",
          clientPhone: (contato?.phone_number as string | null) ?? null,
        },
        prefs: {
          enabled: Boolean(prefs?.alert_proxima_acao),
          phone: (prefs?.alert_whatsapp_phone as string | null) ?? null,
          antecedenciaMin: antecedencia,
        },
        kind,
        agora,
        jaEnviado: Boolean(ja),
      });
      if (!elegivel.ok) {
        pulados += 1;
        continue;
      }

      const entrega = enviarAlertaInternoMock({
        destE164: elegivel.dest,
        demandaId: row.id as string,
        kind,
        contactName: (contato?.display_name as string | null)?.trim() || "Contato",
        textoAcao: (row.proximo_passo as string) ?? "",
        em: row.proximo_passo_em as string,
        agora,
      });

      const { error: erroInsert } = await admin.from("demanda_alert_deliveries").insert({
        organization_id: orgId,
        demanda_id: row.id as string,
        kind,
        scheduled_for: scheduledFor,
        dest_e164: elegivel.dest,
      });
      if (erroInsert) {
        if (erroInsert.code === "23505") {
          pulados += 1;
          continue;
        }
        throw new Error(erroInsert.message);
      }
      entregas.push(entrega);
    }
  }

  return { enviados: entregas.length, pulados, entregas };
}
