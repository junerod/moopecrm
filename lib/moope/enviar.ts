/**
 * Disparo da locadora no WhatsApp do CRM — um locatário, um POST.
 *
 * Só manda se já existe fio com mensagem neste chip. Número frio
 * (ficha nova, agenda, cadastro) não sai — o primeiro toque é no celular.
 * Não acorda o agente. Não é campanha. Reusa sendMessageHandler.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { ApiError } from "@/lib/api/types";
import {
  capabilitiesOf,
  DEFAULT_CHANNEL_PROVIDER,
  type ChannelCapabilities,
} from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";
import { queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { estadoDaJanela, type EstadoDaJanela } from "@/lib/channels/janela";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { ensureConversation } from "@/lib/automation/start-conversation";
import { parseDialablePhone } from "@/lib/messaging/contact-card";
import {
  avaliarDisparoProativo,
  registrarDisparoNoLedger,
  type FreioDoDisparo,
} from "@/lib/moope/pacing-do-disparo";
import { escolherFichaDoTelefone, upsertPessoa } from "@/lib/moope/pessoa";
import { telefoneE164 } from "@/lib/moope/telefone";
import {
  ESPERA_RESTRICAO_DE_ALCANCE_S,
  MENSAGEM_RESTRICAO_DE_ALCANCE,
  ehRestricaoDeAlcance,
} from "@/lib/waha/restricao-de-alcance";

export const CODIGO_SEM_CONVERSA = "conversation_required";
export const MENSAGEM_SEM_CONVERSA =
  "Este número ainda não conversou no WhatsApp da empresa. Mande o primeiro recado pelo celular do chip. Depois o aviso sai daqui.";

export const MOOPE_SEND_ENDPOINT = "moope:send";

export type ModeloDoDisparo = {
  name: string;
  language?: string;
  values?: Record<string, string>;
};

export type PedidoDeEnvioMoope = {
  external_id: string;
  phone: string;
  body?: string;
  template?: ModeloDoDisparo;
  idempotency_key: string;
};

export type ResultadoEnvioMoope =
  | {
      ok: true;
      status: 200;
      message_id: string;
      conversation_id: string;
      deduplicado?: boolean;
    }
  | {
      ok: false;
      status: 409 | 422 | 429 | 503;
      code: string;
      message: string;
      retry_after?: number;
    };

export type EnviarDeps = {
  enviarMensagem?: typeof sendMessageHandler;
  agora?: Date;
  avaliarDisparo?: (
    admin: SupabaseClient,
    orgId: string,
    sessionId: string,
    provider: string,
    agora: Date,
  ) => Promise<FreioDoDisparo>;
  registrarDisparo?: typeof registrarDisparoNoLedger;
  /** Teste: sessão já resolvida. Produção lê channel_sessions WORKING. */
  sessao?: { id: string; provider: string };
  /** Teste: janela já decidida. Produção consulta o canal da sessão. */
  estadoJanela?: (
    provider: string | null | undefined,
    lastInboundAt: string | null,
    agora: Date,
  ) => EstadoDaJanela;
  /** Teste: conversa já resolvida. Produção exige last_message_at. */
  acharConversa?: (
    admin: SupabaseClient,
    orgId: string,
    contactIds: string[],
    sessionId: string,
  ) => Promise<{ id: string; contact_id: string } | null>;
  /** Teste: criar ficha quando o canal não tem banRisk. */
  criarContato?: (
    admin: SupabaseClient,
    orgId: string,
    externalId: string,
    phone: string,
  ) => Promise<string | null>;
  /** Teste: capacidades já resolvidas. Produção pergunta `capabilitiesOf`. */
  capacidades?: ChannelCapabilities;
};

function capacidadesDoCanal(provider: string) {
  try {
    return capabilitiesOf(provider as ChannelProvider);
  } catch {
    return capabilitiesOf(DEFAULT_CHANNEL_PROVIDER);
  }
}

type Contato = {
  id: string;
  phone_number: string | null;
  is_blocked: boolean;
  wa_identity?: string | null;
  wa_lid?: string | null;
};

const COLUNAS_CONTATO = "id, phone_number, is_blocked, wa_identity, wa_lid";

/** Telefones pelos quais este número pode estar gravado — busca, nunca rewrite. */
function variantesDeTelefone(...brutos: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  for (const bruto of brutos) {
    if (!bruto) continue;
    const e164 = parseDialablePhone(bruto);
    for (const v of phoneLookupVariants(e164 ?? bruto)) vistos.add(v);
  }
  return [...vistos];
}

/**
 * Entre fichas da mesma pessoa (nono dígito BR), manda no fio com LID.
 * Sem LID, o telefone do POST (com o 9). Bloqueio de qualquer ficha do par vence.
 * `wa_identity` `phone:` sem LID não rouba o destino.
 */
export function escolherDestinoDoEnvio(
  candidatos: Contato[],
  telefonePedido: string,
): Contato | null {
  if (candidatos.length === 0) return null;
  const bloqueado = candidatos.find((c) => c.is_blocked);
  if (bloqueado) return bloqueado;
  return escolherFichaDoTelefone(candidatos, telefonePedido);
}

export async function enviarPeloCrm(
  admin: SupabaseClient,
  orgId: string,
  pedido: PedidoDeEnvioMoope,
  requestId: string,
  deps: EnviarDeps = {},
): Promise<ResultadoEnvioMoope> {
  const enviar = deps.enviarMensagem ?? sendMessageHandler;
  const agora = deps.agora ?? new Date();

  const fone = telefoneE164(pedido.phone);
  if (!fone) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message: "Telefone inválido. Use E.164 com o 9 do celular BR.",
    };
  }

  const cached = await lerIdempotencia(admin, orgId, pedido.idempotency_key);
  if (cached) return { ok: true, status: 200, ...cached, deduplicado: true };

  const fichas = await listarFichasDoDisparo(admin, orgId, pedido.external_id, fone);
  let contato = escolherDestinoDoEnvio(fichas, fone);
  if (contato?.is_blocked) {
    return {
      ok: false,
      status: 409,
      code: "state_conflict",
      message: "Este contato pediu para parar.",
    };
  }

  const sessao = deps.sessao ?? (await acharSessaoWorking(admin, orgId));
  const caps = deps.capacidades ?? capacidadesDoCanal(sessao?.provider ?? DEFAULT_CHANNEL_PROVIDER);

  if (!contato) {
    if (!sessao || caps.banRisk) {
      return {
        ok: false,
        status: 409,
        code: CODIGO_SEM_CONVERSA,
        message: MENSAGEM_SEM_CONVERSA,
      };
    }
    const criar = deps.criarContato ?? criarContatoMoope;
    const id = await criar(admin, orgId, pedido.external_id, fone);
    if (!id) {
      return {
        ok: false,
        status: 409,
        code: CODIGO_SEM_CONVERSA,
        message: MENSAGEM_SEM_CONVERSA,
      };
    }
    contato = { id, phone_number: fone, is_blocked: false };
    fichas.push(contato);
  }

  if (!sessao) {
    return {
      ok: false,
      status: 503,
      code: "internal_error",
      message: "Nenhum WhatsApp ligado nesta organização.",
    };
  }

  const acharFio = deps.acharConversa ?? acharConversaComMensagem;
  const fio = await acharFio(
    admin,
    orgId,
    fichas.map((f) => f.id),
    sessao.id,
  );
  if (!fio && caps.banRisk) {
    return {
      ok: false,
      status: 409,
      code: CODIGO_SEM_CONVERSA,
      message: MENSAGEM_SEM_CONVERSA,
    };
  }
  if (!fio && !pedido.template && !caps.freeformOutsideWindow) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message:
        "Fora da janela de 24h este canal só aceita modelo aprovado. Envie o SID do modelo e as variáveis.",
    };
  }

  const avaliar = deps.avaliarDisparo ?? avaliarDisparoProativo;
  const freio = await avaliar(admin, orgId, sessao.id, sessao.provider, agora);
  if (!freio.ok) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: freio.message,
      retry_after: freio.retry_after,
    };
  }

  const contatoId = fio?.contact_id ?? contato.id;
  const conversaId = await ensureConversation(admin, orgId, contatoId, sessao.id);
  const { data: conv } = await admin
    .from("conversations")
    .select("last_inbound_at")
    .eq("id", conversaId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const janelaFn = deps.estadoJanela ?? estadoDaJanela;
  const janela = janelaFn(
    sessao.provider,
    (conv as { last_inbound_at: string | null } | null)?.last_inbound_at ?? null,
    agora,
  );
  if (janela.tipo === "fechada" && !pedido.template) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message:
        "Fora da janela de 24h este canal só aceita modelo aprovado. Não enviei texto livre.",
    };
  }

  if (!pedido.template && !pedido.body) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message: "Informe o texto ou o modelo aprovado.",
    };
  }

  let mensagem: { id: string; status: string; error_code?: string | null; error_message?: string | null };
  try {
    mensagem = await enviar(
      admin,
      {
        organization_id: orgId,
        actor: { type: "webhook_source", id: "moope-send" },
        requestId,
        send_intent: "operational_moope",
      },
      pedido.template
        ? {
            conversation_id: conversaId,
            type: "template",
            template_name: pedido.template.name,
            template_language: pedido.template.language ?? "pt_BR",
            template_values: pedido.template.values ?? {},
          }
        : { conversation_id: conversaId, type: "text", body: pedido.body ?? "" },
    );
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
      return {
        ok: false,
        status: 409,
        code: "state_conflict",
        message: err.message || "Contato bloqueou o atendimento.",
      };
    }
    return {
      ok: false,
      status: 503,
      code: "internal_error",
      message: err instanceof Error ? err.message : "Falha ao enviar.",
    };
  }

  const traduzido = traduzirDesfecho(mensagem, conversaId);
  if (traduzido.ok) {
    const registrar = deps.registrarDisparo ?? registrarDisparoNoLedger;
    await registrar(admin, orgId, sessao.id, agora);
    await gravarIdempotencia(admin, orgId, pedido, traduzido);
  }
  return traduzido;
}

export async function listarFichasDoDisparo(
  admin: SupabaseClient,
  orgId: string,
  externalId: string,
  phone: string,
): Promise<Contato[]> {
  const { data: porMeta } = await admin
    .from("contacts")
    .select(COLUNAS_CONTATO)
    .eq("organization_id", orgId)
    .eq("source_metadata->>moope_external_id", externalId)
    .is("is_merged_into", null)
    .limit(1)
    .maybeSingle();

  const variantes = variantesDeTelefone(phone, (porMeta as Contato | null)?.phone_number);
  const porFone =
    variantes.length === 0
      ? []
      : ((
          await admin
            .from("contacts")
            .select(COLUNAS_CONTATO)
            .eq("organization_id", orgId)
            .in("phone_number", variantes)
            .is("is_merged_into", null)
        ).data as Contato[] | null) ?? [];

  const porId = new Map<string, Contato>();
  if (porMeta) porId.set((porMeta as Contato).id, porMeta as Contato);
  for (const row of porFone) porId.set(row.id, row);
  return [...porId.values()];
}

async function criarContatoMoope(
  admin: SupabaseClient,
  orgId: string,
  externalId: string,
  phone: string,
): Promise<string | null> {
  return upsertPessoa(admin, orgId, { external_id: externalId, phone });
}

export async function acharContato(
  admin: SupabaseClient,
  orgId: string,
  externalId: string,
  phone: string,
): Promise<Contato | null> {
  return escolherDestinoDoEnvio(await listarFichasDoDisparo(admin, orgId, externalId, phone), phone);
}

export function conversaTemMensagem(row: {
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
}): boolean {
  return Boolean(row.last_message_at || row.last_inbound_at || row.last_outbound_at);
}

export async function acharConversaComMensagem(
  admin: SupabaseClient,
  orgId: string,
  contactIds: string[],
  sessionId: string,
): Promise<{ id: string; contact_id: string } | null> {
  if (contactIds.length === 0) return null;
  const { data } = await admin
    .from("conversations")
    .select("id, contact_id, last_message_at, last_inbound_at, last_outbound_at")
    .eq("organization_id", orgId)
    .eq("channel_session_id", sessionId)
    .in("contact_id", contactIds)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(8);
  const rows = (data ?? []) as Array<{
    id: string;
    contact_id: string;
    last_message_at?: string | null;
    last_inbound_at?: string | null;
    last_outbound_at?: string | null;
  }>;
  const comMensagem = rows.find(conversaTemMensagem);
  return comMensagem ? { id: comMensagem.id, contact_id: comMensagem.contact_id } : null;
}

async function acharSessaoWorking(
  admin: SupabaseClient,
  orgId: string,
): Promise<{ id: string; provider: string } | null> {
  const { data } = await queryTolerantToMissingArchived(
    () =>
      admin
        .from("channel_sessions")
        .select("id, provider, status, archived_at")
        .eq("organization_id", orgId)
        .eq("status", "WORKING")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    () =>
      admin
        .from("channel_sessions")
        .select("id, provider, status")
        .eq("organization_id", orgId)
        .eq("status", "WORKING")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  );
  const row = data as { id: string; provider: string } | null;
  return row ?? null;
}

export function traduzirDesfecho(
  mensagem: {
    id: string;
    status: string;
    error_code?: string | null;
    error_message?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  conversationId: string,
): ResultadoEnvioMoope {
  if (mensagem.status === "sent" || mensagem.status === "delivered" || mensagem.status === "read") {
    return {
      ok: true,
      status: 200,
      message_id: mensagem.id,
      conversation_id: conversationId,
    };
  }

  const codigo = `${mensagem.error_code ?? ""} ${mensagem.error_message ?? ""} ${mensagem.metadata?.queued_reason ?? ""}`.toLowerCase();
  if (ehRestricaoDeAlcance(codigo)) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: MENSAGEM_RESTRICAO_DE_ALCANCE,
      retry_after: ESPERA_RESTRICAO_DE_ALCANCE_S,
    };
  }
  if (/429|rate|pacing|throttl/.test(codigo)) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: "O canal pediu espera. Tente este locatário de novo.",
      retry_after: 6,
    };
  }
  if (/template|131047|window|janela/.test(codigo)) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message: "Este canal exige modelo aprovado fora da janela de 24h.",
    };
  }
  if (/blocked|opt.out|is_blocked/.test(codigo)) {
    return {
      ok: false,
      status: 409,
      code: "state_conflict",
      message: "Este contato pediu para parar.",
    };
  }
  return {
    ok: false,
    status: 503,
    code: "internal_error",
    message: mensagem.error_message || "Canal indisponível. A mensagem não saiu.",
  };
}

async function lerIdempotencia(
  admin: SupabaseClient,
  orgId: string,
  key: string,
): Promise<{ message_id: string; conversation_id: string } | null> {
  const { data } = await admin
    .from("idempotency_keys")
    .select("response_body")
    .eq("organization_id", orgId)
    .eq("endpoint", MOOPE_SEND_ENDPOINT)
    .eq("key", key)
    .maybeSingle();
  const body = data?.response_body as { message_id?: string; conversation_id?: string } | undefined;
  if (!body?.message_id || !body.conversation_id) return null;
  return { message_id: body.message_id, conversation_id: body.conversation_id };
}

async function gravarIdempotencia(
  admin: SupabaseClient,
  orgId: string,
  pedido: PedidoDeEnvioMoope,
  ok: { message_id: string; conversation_id: string },
): Promise<void> {
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ external_id: pedido.external_id, body: pedido.body, phone: pedido.phone }))
    .digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("idempotency_keys").insert({
    organization_id: orgId,
    endpoint: MOOPE_SEND_ENDPOINT,
    key: pedido.idempotency_key,
    request_hash: requestHash,
    response_body: { message_id: ok.message_id, conversation_id: ok.conversation_id },
    status_code: 200,
    expires_at: expiresAt,
  });
  if (error && error.code !== "23505") {
    // Sem cache o reenvio pode duplicar — o caller já tem 200 desta vez.
  }
}
