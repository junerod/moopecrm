/**
 * Eventos que o parceiro MANDA — cadastro → CRM.
 *
 * Não abre inbox e não acorda o agente. Pessoa nova aparece em Contatos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { upsertPessoa } from "@/lib/moope/pessoa";
import { telefoneE164 } from "@/lib/moope/telefone";
import type {
  DividaDoParceiro,
  MoopeInboundType,
  MoopeKind,
  NegocioDoParceiro,
  PessoaDoParceiro,
} from "@/lib/moope/tipos";

const ACTOR_SISTEMA = { type: "webhook_source" as const, id: "moope" };

const FAIXA_PARA_ETAPA: Record<NonNullable<DividaDoParceiro["faixa"]>, string> = {
  em_dia: "Em dia",
  atraso: "Atraso",
  negociando: "Negociando",
  promessa: "Promessa de pagamento",
  recuperou: "Recuperou",
  perdeu: "Perdeu",
};

export interface ResultadoDoEvento {
  ok: boolean;
  duplicado?: boolean;
  contact_id?: string;
  lead_id?: string;
  motivo?: string;
}

export async function processarEventoInbound(
  admin: SupabaseClient,
  orgId: string,
  connectionId: string,
  kind: MoopeKind,
  type: MoopeInboundType,
  externalId: string,
  payload: Record<string, unknown>,
): Promise<ResultadoDoEvento> {
  const { error: insErr } = await admin.from("moope_inbound_events").insert({
    organization_id: orgId,
    connection_id: connectionId,
    external_id: externalId,
    event_type: type,
    payload,
    processed_at: new Date().toISOString(),
  } as never);

  if (insErr?.code === "23505") {
    // O unique é (org, external_id): o locatário 1 só entra uma vez.
    // person.upserted TEM de atualizar de novo — senão o nono dígito
    // e o nome do WhatsApp nunca se corrigem no re-save.
    if (type === "person.upserted") {
      const pessoa = pessoaDoPayload(payload, externalId);
      const contactId = await upsertPessoa(admin, orgId, pessoa);
      return { ok: true, duplicado: true, contact_id: contactId ?? undefined };
    }
    return { ok: true, duplicado: true };
  }
  if (insErr) {
    return { ok: false, motivo: insErr.message };
  }

  if (type === "person.upserted") {
    const pessoa = pessoaDoPayload(payload, externalId);
    const contactId = await upsertPessoa(admin, orgId, pessoa);
    return { ok: true, contact_id: contactId ?? undefined };
  }

  if (type === "contract.changed" || type === "process.changed") {
    const negocio = negocioDoPayload(payload, externalId);
    const nomeFunil = type === "contract.changed" ? "Locatários" : "Processos";
    const contactId = await upsertPessoa(admin, orgId, {
      external_id: negocio.person_external_id,
      name: typeof payload.person_name === "string" ? payload.person_name : undefined,
      phone: telefoneE164(payload.phone),
      email: emailValido(payload.email),
    });
    const leadId = await upsertCard(admin, orgId, nomeFunil, negocio, contactId, type);
    return { ok: true, contact_id: contactId ?? undefined, lead_id: leadId ?? undefined };
  }

  if (type === "debt.changed") {
    if (kind !== "locadora") {
      return { ok: true, motivo: "debt.changed só vale para locadora" };
    }
    const divida = dividaDoPayload(payload, externalId);
    const contactId = await upsertPessoa(admin, orgId, {
      external_id: divida.person_external_id,
      name: typeof payload.person_name === "string" ? payload.person_name : undefined,
      phone: telefoneE164(payload.phone),
    });
    const leadId = await upsertCard(
      admin,
      orgId,
      "Cobrança",
      {
        external_id: divida.external_id,
        person_external_id: divida.person_external_id,
        title: typeof payload.title === "string" ? payload.title : "Cobrança",
        stage: divida.faixa ? FAIXA_PARA_ETAPA[divida.faixa] : undefined,
        value_cents: divida.amount_cents,
      },
      contactId,
      type,
    );
    if (leadId && divida.faixa) {
      await emitLeadActivity(admin, {
        organizationId: orgId,
        leadId,
        contactId,
        type: "note",
        sourceModule: "moope",
        sourceId: externalId,
        actor: ACTOR_SISTEMA,
        reason: `Atraso/faixa: ${divida.faixa}${divida.days_late != null ? ` (${divida.days_late} dia(s))` : ""}`,
        payload: { faixa: divida.faixa, amount_cents: divida.amount_cents, days_late: divida.days_late },
      });
    }
    return { ok: true, contact_id: contactId ?? undefined, lead_id: leadId ?? undefined };
  }

  return { ok: false, motivo: "tipo desconhecido" };
}

function emailValido(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpo)) return limpo;
  return undefined;
}

function pessoaDoPayload(payload: Record<string, unknown>, fallbackId: string): PessoaDoParceiro {
  return {
    external_id:
      typeof payload.external_id === "string" && payload.external_id
        ? payload.external_id
        : fallbackId,
    name: typeof payload.name === "string" ? payload.name : undefined,
    phone: telefoneE164(payload.phone),
    email: emailValido(payload.email),
    metadata: payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : undefined,
  };
}

function negocioDoPayload(payload: Record<string, unknown>, fallbackId: string): NegocioDoParceiro {
  return {
    external_id:
      typeof payload.external_id === "string" && payload.external_id
        ? payload.external_id
        : fallbackId,
    person_external_id:
      typeof payload.person_external_id === "string" ? payload.person_external_id : fallbackId,
    title: typeof payload.title === "string" ? payload.title : undefined,
    stage: typeof payload.stage === "string" ? payload.stage : undefined,
    value_cents: typeof payload.value_cents === "number" ? payload.value_cents : undefined,
    status: typeof payload.status === "string" ? payload.status : undefined,
  };
}

function dividaDoPayload(payload: Record<string, unknown>, fallbackId: string): DividaDoParceiro {
  const faixa = payload.faixa;
  const faixas = ["em_dia", "atraso", "negociando", "promessa", "recuperou", "perdeu"] as const;
  return {
    external_id:
      typeof payload.external_id === "string" && payload.external_id
        ? payload.external_id
        : fallbackId,
    person_external_id:
      typeof payload.person_external_id === "string" ? payload.person_external_id : fallbackId,
    faixa: typeof faixa === "string" && (faixas as readonly string[]).includes(faixa)
      ? (faixa as DividaDoParceiro["faixa"])
      : undefined,
    amount_cents: typeof payload.amount_cents === "number" ? payload.amount_cents : undefined,
    days_late: typeof payload.days_late === "number" ? payload.days_late : undefined,
  };
}

async function upsertCard(
  admin: SupabaseClient,
  orgId: string,
  nomeFunil: string,
  negocio: NegocioDoParceiro,
  contactId: string | null,
  eventType: string,
): Promise<string | null> {
  const { data: ja } = await admin
    .from("crm_leads")
    .select("id, stage_id, pipeline_id")
    .eq("organization_id", orgId)
    .eq("source", "moope")
    .eq("external_id", negocio.external_id)
    .maybeSingle();

  const funil = await acharFunil(admin, orgId, nomeFunil);
  if (!funil) return (ja as { id: string } | null)?.id ?? null;

  const etapa = await acharEtapa(admin, orgId, funil.id, negocio.stage);

  if (ja) {
    const id = (ja as { id: string }).id;
    const patch: Record<string, unknown> = {
      title: negocio.title ?? undefined,
      contact_id: contactId,
      source_metadata: { moope_external_id: negocio.external_id, event: eventType },
    };
    if (negocio.value_cents != null) patch.value_cents = negocio.value_cents;
    if (etapa && etapa.id !== (ja as { stage_id: string }).stage_id) {
      patch.stage_id = etapa.id;
    }
    const limpo = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await admin.from("crm_leads").update(limpo as never).eq("id", id).eq("organization_id", orgId);
    await garantirLink(admin, orgId, id, negocio.external_id);
    return id;
  }

  if (!etapa) return null;

  const { data: maxRow } = await admin
    .from("crm_leads")
    .select("position_in_stage")
    .eq("stage_id", etapa.id)
    .order("position_in_stage", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = maxRow?.position_in_stage ? Number(maxRow.position_in_stage) + 1000 : 1000;

  const { data: criado, error } = await admin
    .from("crm_leads")
    .insert({
      organization_id: orgId,
      pipeline_id: funil.id,
      stage_id: etapa.id,
      title: negocio.title || negocio.external_id,
      contact_id: contactId,
      value_cents: negocio.value_cents ?? null,
      currency: "BRL",
      source: "moope",
      external_id: negocio.external_id,
      source_metadata: { moope_external_id: negocio.external_id, event: eventType },
      status: "open",
      position_in_stage: nextPos,
      tags: [],
      custom_fields: {},
    } as never)
    .select("id")
    .single();
  if (error || !criado) return null;
  const id = (criado as { id: string }).id;
  await garantirLink(admin, orgId, id, negocio.external_id);
  return id;
}

async function acharFunil(
  admin: SupabaseClient,
  orgId: string,
  nome: string,
): Promise<{ id: string } | null> {
  const { data } = await admin
    .from("crm_pipelines")
    .select("id, name, slug")
    .eq("organization_id", orgId)
    .eq("is_archived", false);
  const lista = (data ?? []) as Array<{ id: string; name: string; slug: string }>;
  const alvo = nome.toLowerCase();
  return (
    lista.find((p) => p.name.toLowerCase() === alvo) ??
    lista.find((p) => p.slug.toLowerCase().includes(alvo.replace(/ç/g, "c").replace(/\s+/g, "-"))) ??
    null
  );
}

async function acharEtapa(
  admin: SupabaseClient,
  orgId: string,
  pipelineId: string,
  nomeEtapa: string | undefined,
): Promise<{ id: string; name: string } | null> {
  const { data } = await admin
    .from("crm_stages")
    .select("id, name, position, is_won, is_lost")
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  const etapas = (data ?? []) as Array<{ id: string; name: string; is_won: boolean; is_lost: boolean }>;
  if (etapas.length === 0) return null;
  if (nomeEtapa) {
    const chave = nomeEtapa.trim().toLowerCase();
    const achada = etapas.find((e) => e.name.toLowerCase() === chave);
    if (achada) return achada;
  }
  return etapas.find((e) => !e.is_won && !e.is_lost) ?? etapas[0] ?? null;
}

async function garantirLink(
  admin: SupabaseClient,
  orgId: string,
  leadId: string,
  externalId: string,
): Promise<void> {
  const { data: ja } = await admin
    .from("crm_lead_links")
    .select("id")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .eq("target_kind", "external")
    .eq("link_kind", "moope")
    .maybeSingle();
  if (ja) return;
  await admin.from("crm_lead_links").insert({
    organization_id: orgId,
    lead_id: leadId,
    target_kind: "external",
    target_id: leadId,
    link_kind: "moope",
    metadata: { moope_external_id: externalId },
  } as never);
}
