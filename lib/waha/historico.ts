/**
 * Traz para o CRM o legado do aparelho — em TRÊS tempos, de propósito.
 *
 * 1. Ao conectar / reconectar / cron: CONTATOS (agenda + chats).
 * 2. Na mesma rodada: FIOS NOVOS — chat do aparelho com atividade DEPOIS
 *    da última mensagem que o inbox já tem (ou das últimas 48h se a fila
 *    está vazia). É o recorte que o suporte precisa: duas conversas de
 *    agora entram sozinhas; dois mil chats de 2019 não.
 * 3. No dossiê, "Importar conversa" puxa o arquivo INTEIRO daquela pessoa.
 *
 * Mensagem importada leva `metadata.historico=true`; o gatilho recusa
 * emitir `message.received`. Sem a marca a IA responderia cliente velho.
 * Menu (1/2/3) e handoff só rodam no webhook AO VIVO — recorte atrasado
 * não replaya automação, só coloca o fio na fila para uma pessoa ver.
 */
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { emitirParaParceiro } from "@/lib/moope/emitir";
import type { ProgressoHistorico, StatusDoHistorico } from "@/lib/channels/historico-tipos";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { WahaPayload } from "@/lib/waha/envelope";
import {
  carimbarConversaDoHistorico,
  ingerirMensagemHistorica,
  upsertContatoDoHistorico,
} from "@/lib/waha/ingest";
import { resolveWahaChatId } from "@/lib/waha/send";
import {
  getWahaClient,
  WahaLojaIndisponivel,
  type WahaClient,
} from "@/lib/waha/client";

export type { ProgressoHistorico, StatusDoHistorico };

type Admin = ReturnType<typeof createAdminClient>;

/** Agenda + chats. Teto baixo escondia o legado do escritório. */
export const HISTORICO_MAX_CHATS = 2_000;
/** Agenda do aparelho — maior que o recorte de chats. */
export const HISTORICO_MAX_CONTATOS = 10_000;
export const HISTORICO_MAX_MSGS_POR_CHAT = 500;
export const HISTORICO_TENTATIVAS_LOJA = 5;
export const HISTORICO_ESPERA_LOJA_MS = 2_000;
/** Se um "rodando" ficou preso (processo morto), libera o botão. */
export const HISTORICO_TRAVADO_MS = 15 * 60 * 1000;
/**
 * Abaixo disto a loja é recorte de atividade, não agenda de número antigo.
 * Medido: sessão WORKING com store ligado e 21 nomes / 4 chats / 4 lids.
 */
export const LOJA_CURTA = 80;
export const REINICIO_AGENDA_MS = 6 * 60 * 60 * 1000;
/** Inbox vazio: não importa a agenda inteira, só o que mexeu neste recorte. */
export const JANELA_INBOX_VAZIA_MS = 48 * 60 * 60 * 1000;
export const SOBREPOSICAO_FIOS_MS = 10 * 60 * 1000;
export const FIOS_NOVOS_POR_RODADA = 40;
/** Recorte automático não baixa o arquivo inteiro — só o bastante pro inbox. */
export const TETO_MSGS_FIO_NOVO = 80;
/** Fio que já está no inbox só atualiza se o aparelho estiver claramente na frente. */
export const FOLGA_FIO_JA_NO_INBOX_MS = 2 * 60 * 1000;


export type SessaoParaHistorico = {
  id: string;
  organization_id: string;
  waha_session_name: string;
};

export type ClienteDaLoja = Pick<
  WahaClient,
  "convergirConfigDaSessao" | "listChats" | "listChatMessages"
> & {
  listContacts?: (session: string) => Promise<unknown[]>;
  reiniciarSessao?: (session: string) => Promise<void>;
  resolvePhoneForLid?: WahaClient["resolvePhoneForLid"];
};

export type DepsDoHistorico = {
  cliente?: ClienteDaLoja;
  dormir?: (ms: number) => Promise<void>;
  agora?: () => string;
  /** Cron periódico não audita rodada que só reconfirmou a lista. */
  auditar?: boolean;
  /**
   * Clique em Atualizar: se a loja veio curta, para e sobe a sessão
   * para o WhatsApp reenviar a agenda. O cron NÃO liga isto.
   */
  pedirAgendaCompleta?: boolean;
  /** Teto de mensagens por fio. O recorte automático usa um teto menor. */
  tetoMsgs?: number;
};

const SUFIXOS_FORA = ["@g.us", "@broadcast", "@newsletter"];

/** Agenda às vezes manda só o número, sem `@c.us`. Sem o sufixo a RPC recusa. */
function normalizarIdDePessoa(id: string): string {
  const t = id.trim();
  if (t.includes("@")) return t;
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 8) return `${digits}@c.us`;
  return t;
}

export function idDoChat(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.number === "string" && o.number.replace(/\D/g, "").length >= 8) {
    return normalizarIdDePessoa(o.number);
  }
  if (typeof o.id === "string" && o.id.length > 0) return normalizarIdDePessoa(o.id);
  if (o.id && typeof o.id === "object") {
    const ser = (o.id as { _serialized?: unknown })._serialized;
    if (typeof ser === "string" && ser.length > 0) return normalizarIdDePessoa(ser);
    const user = (o.id as { user?: unknown }).user;
    const server = (o.id as { server?: unknown }).server;
    if (typeof user === "string" && user.length > 0) {
      const sufixo = typeof server === "string" && server.length > 0 ? server : "c.us";
      return normalizarIdDePessoa(`${user}@${sufixo}`);
    }
  }
  if (typeof o.chatId === "string" && o.chatId.length > 0) {
    return normalizarIdDePessoa(o.chatId);
  }
  return null;
}

export function timestampDoChat(item: unknown): number {
  if (!item || typeof item !== "object") return 0;
  const o = item as Record<string, unknown>;
  const n = o.conversationTimestamp ?? o.timestamp;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** WAHA manda segundos; alguns payloads já vêm em ms. */
export function instanteDoChat(ts: number): number {
  if (ts <= 0) return 0;
  return ts > 1e12 ? ts : ts * 1000;
}

/**
 * Até onde olhar no aparelho.
 *
 * Inbox vazio ou recente: últimas 48h (não importa 2019).
 * Inbox parado há mais que 48h: desde a última mensagem que já está lá
 * — é o recorte depois de um fim de semana sem ninguém na tela.
 */
export function corteDosFiosNovos(agoraMs: number, ultimaInboxMs: number | null): number {
  const piso = agoraMs - JANELA_INBOX_VAZIA_MS;
  const fundo = ultimaInboxMs !== null && ultimaInboxMs < piso ? ultimaInboxMs : piso;
  return fundo - SOBREPOSICAO_FIOS_MS;
}

/** Órfão entra; fio que já está no inbox só se o aparelho estiver à frente. */
export function fioPrecisaEntrarNoInbox(
  instanteChatMs: number,
  ultimaDesteContatoMs: number | null,
): boolean {
  if (instanteChatMs <= 0) return false;
  if (ultimaDesteContatoMs == null) return true;
  return instanteChatMs > ultimaDesteContatoMs + FOLGA_FIO_JA_NO_INBOX_MS;
}

function telefoneDoChatId(id: string): string | null {
  const baixo = id.toLowerCase();
  if (!baixo.endsWith("@c.us") && !baixo.endsWith("@s.whatsapp.net")) return null;
  const digits = id.replace(/@.*$/, "").replace(/\D/g, "");
  return digits.length >= 8 ? `+${digits}` : null;
}

function lidDoChatId(id: string): string | null {
  if (!id.toLowerCase().endsWith("@lid")) return null;
  const digits = id.replace(/@lid$/i, "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function nomeDoChat(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  // WAHA documenta `pushname` (minúsculo). Pedir só `pushName` largava
  // a agenda inteira: nesta instalação o /contacts/all veio 20× @lid
  // com pushname e 0 com name — o CRM gravava só os 4 chats.
  for (const k of ["name", "notifyName", "pushName", "pushname", "notify", "shortName"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Chat que o CRM não atende — grupo, estado, canal. */
export function chatFicaDeFora(chatId: string): boolean {
  const id = chatId.toLowerCase();
  if (id === "status@broadcast") return true;
  return SUFIXOS_FORA.some((s) => id.endsWith(s));
}

/** Texto que a loja esconde em conversation / extendedText / caption. */
export function corpoDaMensagemDaLoja(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  for (const v of [o.body, o.caption, o.text]) {
    if (typeof v === "string" && v.trim()) return v;
  }
  const data = o._data && typeof o._data === "object" ? (o._data as Record<string, unknown>) : null;
  if (data) {
    for (const v of [data.body, data.caption]) {
      if (typeof v === "string" && v.trim()) return v;
    }
    const msg = data.message && typeof data.message === "object"
      ? (data.message as Record<string, unknown>)
      : null;
    if (msg) {
      if (typeof msg.conversation === "string" && msg.conversation.trim()) {
        return msg.conversation;
      }
      const ext = msg.extendedTextMessage;
      if (ext && typeof ext === "object") {
        const t = (ext as { text?: unknown }).text;
        if (typeof t === "string" && t.trim()) return t;
      }
      for (const k of ["imageMessage", "videoMessage", "documentMessage"]) {
        const midia = msg[k];
        if (midia && typeof midia === "object") {
          const cap = (midia as { caption?: unknown }).caption;
          if (typeof cap === "string" && cap.trim()) return cap;
        }
      }
    }
  }
  return null;
}

function idDaMensagem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id === "string" && o.id.length > 0) return o.id;
  if (o.id && typeof o.id === "object") {
    const ser = (o.id as { _serialized?: unknown })._serialized;
    if (typeof ser === "string" && ser.length > 0) return ser;
    const inner = (o.id as { id?: unknown }).id;
    if (typeof inner === "string" && inner.length > 0) return inner;
  }
  return null;
}

/**
 * Traduz a forma da loja para o contrato que a ingestão já conhece.
 *
 * Devolve null quando não há o que gravar (sem id, ou protocolo sem corpo).
 * A ingestão ao vivo tem a mesma guarda — duplicá-la aqui evita um segundo
 * vocabulário de "o que é mensagem".
 */
export function mensagemDaLojaParaPayload(
  chatId: string,
  raw: unknown,
): WahaPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = idDaMensagem(raw);
  if (!id) return null;

  const fromMe = o.fromMe === true;
  const from =
    typeof o.from === "string" && o.from.length > 0
      ? o.from
      : fromMe
        ? undefined
        : chatId;
  const to =
    typeof o.to === "string" && o.to.length > 0
      ? o.to
      : fromMe
        ? chatId
        : undefined;
  const body = corpoDaMensagemDaLoja(raw) ?? undefined;
  const hasMedia = o.hasMedia === true;
  const type = typeof o.type === "string" ? o.type : undefined;
  const ack = typeof o.ack === "number" ? o.ack : undefined;
  const ackName = typeof o.ackName === "string" ? o.ackName : undefined;
  const timestamp = typeof o.timestamp === "number" ? o.timestamp : undefined;
  const mediaUrl = typeof o.mediaUrl === "string" ? o.mediaUrl : undefined;
  const mimetype = typeof o.mimetype === "string" ? o.mimetype : undefined;
  const media =
    o.media && typeof o.media === "object"
      ? (o.media as { url?: string | null; mimetype?: string | null })
      : undefined;
  const _data =
    o._data && typeof o._data === "object"
      ? (o._data as WahaPayload["_data"])
      : undefined;

  const payload: WahaPayload = {
    id,
    from,
    to,
    fromMe,
    body,
    type,
    hasMedia,
    ack,
    ackName,
    timestamp,
    mediaUrl,
    mimetype,
    media,
    _data,
  };

  const temCorpo = Boolean(body && body.length > 0);
  const temMidia = Boolean(hasMedia || mediaUrl || media?.url);
  if (!temCorpo && !temMidia) return null;
  return payload;
}

function progressoDe(metadata: unknown): ProgressoHistorico | null {
  if (!metadata || typeof metadata !== "object") return null;
  const h = (metadata as { historico?: unknown }).historico;
  if (!h || typeof h !== "object") return null;
  const o = h as Partial<ProgressoHistorico>;
  if (o.status !== "rodando" && o.status !== "pronto" && o.status !== "erro") {
    return null;
  }
  return {
    status: o.status,
    iniciado_em: typeof o.iniciado_em === "string" ? o.iniciado_em : "",
    terminado_em: typeof o.terminado_em === "string" ? o.terminado_em : undefined,
    conversas: typeof o.conversas === "number" ? o.conversas : 0,
    mensagens: typeof o.mensagens === "number" ? o.mensagens : 0,
    puladas: typeof o.puladas === "number" ? o.puladas : 0,
    contatos: typeof o.contatos === "number" ? o.contatos : undefined,
    motivo: typeof o.motivo === "string" ? o.motivo : undefined,
    loja_curta: o.loja_curta === true ? true : undefined,
  };
}

export function lerProgressoDoMetadata(metadata: unknown): ProgressoHistorico | null {
  return progressoDe(metadata);
}

export function historicoTravado(p: ProgressoHistorico, agoraMs: number): boolean {
  if (p.status !== "rodando") return false;
  const t = Date.parse(p.iniciado_em);
  if (!Number.isFinite(t)) return true;
  return agoraMs - t > HISTORICO_TRAVADO_MS;
}

async function gravarProgresso(
  admin: Admin,
  sessao: SessaoParaHistorico,
  metadataAtual: Record<string, unknown>,
  progresso: ProgressoHistorico,
): Promise<void> {
  const { error } = await admin
    .from("channel_sessions")
    .update({ metadata: { ...metadataAtual, historico: progresso } })
    .eq("organization_id", sessao.organization_id)
    .eq("id", sessao.id);
  if (error) {
    logger.warn("historico: nao gravei o progresso", {
      organization_id: sessao.organization_id,
      channel_session_id: sessao.id,
      detail: error.message.slice(0, 160),
    });
  }
}

const MSG_LOJA =
  "O aparelho ainda não entregou a lista. Reconecte o número e escaneie o QR de novo — só assim os contatos antigos entram.";

export function chatIdDoContato(c: {
  phone_number: string | null;
  wa_identity?: string | null;
  wa_lid?: string | null;
  source_metadata: unknown;
}): string | null {
  if (c.source_metadata && typeof c.source_metadata === "object") {
    const id = (c.source_metadata as Record<string, unknown>).waha_chat_id;
    if (typeof id === "string" && id.length > 0 && !chatFicaDeFora(id)) return id;
  }
  return resolveWahaChatId({
    isGroup: false,
    groupChatId: null,
    phoneNumber: c.phone_number,
    waIdentity: c.wa_identity,
    waLid: c.wa_lid,
  });
}

function jaReiniciouAgendaHaPouco(metadata: Record<string, unknown>, agoraMs: number): boolean {
  const iso = metadata.reinicio_agenda_em;
  if (typeof iso !== "string") return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return agoraMs - t < REINICIO_AGENDA_MS;
}

async function lerAgendaEChats(
  cliente: ClienteDaLoja,
  nome: string,
  orgId: string,
  dormir: (ms: number) => Promise<void>,
  tentativas = HISTORICO_TENTATIVAS_LOJA,
): Promise<{ chats: unknown[]; agenda: unknown[] }> {
  const chats = await listarChatsComEspera(cliente, nome, dormir, tentativas);
  let agenda: unknown[] = [];
  if (cliente.listContacts) {
    try {
      agenda = await cliente.listContacts(nome);
    } catch (err) {
      if (err instanceof WahaLojaIndisponivel) throw err;
      logger.warn("historico: agenda do aparelho nao veio; sigo com os chats", {
        organization_id: orgId,
        detail: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      });
    }
  }
  return { chats, agenda };
}

async function listarChatsComEspera(
  cliente: ClienteDaLoja,
  nome: string,
  dormir: (ms: number) => Promise<void>,
  tentativas = HISTORICO_TENTATIVAS_LOJA,
): Promise<unknown[]> {
  let ultimo: unknown = null;
  for (let i = 0; i < tentativas; i++) {
    try {
      const todos: unknown[] = [];
      const pagina = 200;
      for (let offset = 0; offset < HISTORICO_MAX_CHATS; offset += pagina) {
        const lote = await cliente.listChats(nome, pagina, offset);
        todos.push(...lote);
        if (lote.length < pagina) break;
      }
      return todos;
    } catch (err) {
      ultimo = err;
      if (!(err instanceof WahaLojaIndisponivel)) throw err;
      if (i < tentativas - 1) await dormir(HISTORICO_ESPERA_LOJA_MS);
    }
  }
  throw ultimo instanceof Error ? ultimo : new WahaLojaIndisponivel("loja vazia");
}

/**
 * Id opaco sem telefone e sem nome vira "Sem nome" na lista e não dá
 * para buscar conversa. Agenda do aparelho está cheia desses.
 */
export function contatoDaAgendaMereceLista(id: string, nome: string | null): boolean {
  if (!id || chatFicaDeFora(id)) return false;
  const baixo = id.toLowerCase();
  if (baixo.endsWith("@c.us") || baixo.endsWith("@s.whatsapp.net")) return true;
  const nomeUtil = Boolean(nome && nome.trim() && !nome.includes("@"));
  if (baixo.endsWith("@lid")) return nomeUtil;
  return false;
}

function itemDaAgendaFicaDeFora(item: unknown): boolean {
  if (!item || typeof item !== "object") return true;
  const o = item as Record<string, unknown>;
  if (o.isMe === true || o.isGroup === true) return true;
  const id = idDoChat(item);
  if (!id || chatFicaDeFora(id)) return true;
  return !contatoDaAgendaMereceLista(id, nomeDoChat(item));
}

function unirAgenda(chats: unknown[], agenda: unknown[]): unknown[] {
  const porId = new Map<string, unknown>();
  // Chat primeiro: tem nome e data. Agenda só entra quem ainda não apareceu
  // — o número salvo que nunca escreveu, ou cuja conversa saiu do recorte.
  for (const item of [...chats, ...agenda]) {
    if (itemDaAgendaFicaDeFora(item)) continue;
    const id = idDoChat(item);
    if (!id || porId.has(id)) continue;
    porId.set(id, item);
  }
  return [...porId.values()];
}

async function ultimaMensagemDoInbox(
  admin: Admin,
  sessao: SessaoParaHistorico,
): Promise<number | null> {
  const { data, error } = await admin
    .from("conversations")
    .select("last_message_at")
    .eq("organization_id", sessao.organization_id)
    .eq("channel_session_id", sessao.id)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.last_message_at) return null;
  const t = Date.parse(data.last_message_at);
  return Number.isFinite(t) ? t : null;
}

async function ultimaPorContatoNoInbox(
  admin: Admin,
  sessao: SessaoParaHistorico,
  contactIds: string[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (contactIds.length === 0) return mapa;
  const { data, error } = await admin
    .from("conversations")
    .select("contact_id, last_message_at")
    .eq("organization_id", sessao.organization_id)
    .eq("channel_session_id", sessao.id)
    .in("contact_id", contactIds);
  if (error || !data) return mapa;
  for (const row of data as { contact_id?: string | null; last_message_at?: string | null }[]) {
    if (!row.contact_id || !row.last_message_at) continue;
    const t = Date.parse(row.last_message_at);
    if (Number.isFinite(t)) mapa.set(row.contact_id, t);
  }
  return mapa;
}

/**
 * Fios do aparelho que o inbox ainda não tem — ou que o aparelho passou
 * na frente. Não é "importar a agenda"; é o recorte do suporte.
 */
async function puxarFiosNovos(
  admin: Admin,
  sessao: SessaoParaHistorico,
  cliente: ClienteDaLoja,
  chats: unknown[],
  contatoPorChat: Map<string, string>,
  deps: DepsDoHistorico,
  agora: () => string,
): Promise<{ conversas: number; mensagens: number }> {
  const agoraMs = Date.parse(agora()) || Date.now();
  const watermark = await ultimaMensagemDoInbox(admin, sessao);
  const desde = corteDosFiosNovos(agoraMs, watermark);

  const recentes = chats
    .map((raw) => ({ raw, id: idDoChat(raw), ts: timestampDoChat(raw) }))
    .filter((c): c is { raw: unknown; id: string; ts: number } => Boolean(c.id))
    .filter((c) => !chatFicaDeFora(c.id) && instanteDoChat(c.ts) > desde)
    .sort((a, b) => b.ts - a.ts);

  const ids = recentes
    .map((c) => contatoPorChat.get(c.id))
    .filter((id): id is string => Boolean(id));
  const jaNoInbox = await ultimaPorContatoNoInbox(admin, sessao, ids);

  const pendentes = recentes
    .filter((c) => {
      const contactId = contatoPorChat.get(c.id);
      if (!contactId) return false;
      return fioPrecisaEntrarNoInbox(instanteDoChat(c.ts), jaNoInbox.get(contactId) ?? null);
    })
    .slice(0, FIOS_NOVOS_POR_RODADA);

  let conversas = 0;
  let mensagens = 0;
  for (const chat of pendentes) {
    const contactId = contatoPorChat.get(chat.id);
    if (!contactId) continue;
    const r = await importarConversaDoContato(
      admin,
      sessao,
      {
        id: contactId,
        organization_id: sessao.organization_id,
        phone_number: telefoneDoChatId(chat.id),
        display_name: nomeDoChat(chat.raw),
        source_metadata: { waha_chat_id: chat.id },
      },
      {
        cliente,
        agora,
        dormir: deps.dormir,
        auditar: false,
        tetoMsgs: TETO_MSGS_FIO_NOVO,
      },
    );
    if (r.ok && r.conversationId && r.mensagens > 0) {
      conversas += 1;
      mensagens += r.mensagens;
    }
  }
  return { conversas, mensagens };
}

/**
 * Percorre a loja: grava contato e, no recorte recente, o fio que o
 * inbox ainda não tem. Idempotente pela identidade WhatsApp.
 *
 * Quem chama já resolveu organização de fonte confiável (cookie/JWT). O
 * `organization_id` da sessão NÃO vem do body.
 */
export async function puxarHistorico(
  admin: Admin,
  sessao: SessaoParaHistorico,
  deps: DepsDoHistorico = {},
): Promise<ProgressoHistorico> {
  const agora = deps.agora ?? (() => new Date().toISOString());
  const dormir = deps.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const cliente = deps.cliente ?? getWahaClient();
  const iniciado = agora();

  const vazio: ProgressoHistorico = {
    status: "rodando",
    iniciado_em: iniciado,
    contatos: 0,
    conversas: 0,
    mensagens: 0,
    puladas: 0,
  };

  const { data: linha } = await admin
    .from("channel_sessions")
    .select("metadata")
    .eq("organization_id", sessao.organization_id)
    .eq("id", sessao.id)
    .maybeSingle();
  const metadataAtual =
    linha?.metadata && typeof linha.metadata === "object"
      ? { ...(linha.metadata as Record<string, unknown>) }
      : {};

  await gravarProgresso(admin, sessao, metadataAtual, vazio);

  if (!cliente) {
    const erro: ProgressoHistorico = {
      ...vazio,
      status: "erro",
      terminado_em: agora(),
      motivo: "A conexão de WhatsApp ainda não foi configurada nesta instalação.",
    };
    await gravarProgresso(admin, sessao, metadataAtual, erro);
    return erro;
  }

  try {
    await cliente.convergirConfigDaSessao(sessao.waha_session_name);
    let { chats, agenda } = await lerAgendaEChats(
      cliente,
      sessao.waha_session_name,
      sessao.organization_id,
      dormir,
    );
    const naLoja = agenda.length + chats.length;
    if (
      deps.pedirAgendaCompleta &&
      cliente.reiniciarSessao &&
      naLoja < LOJA_CURTA &&
      !jaReiniciouAgendaHaPouco(metadataAtual, Date.parse(iniciado) || Date.now())
    ) {
      logger.warn("historico: loja curta, reinicio a sessao para o WhatsApp reenviar a agenda", {
        organization_id: sessao.organization_id,
        na_loja: naLoja,
      });
      await cliente.reiniciarSessao(sessao.waha_session_name);
      metadataAtual.reinicio_agenda_em = agora();
      const segunda = await lerAgendaEChats(
        cliente,
        sessao.waha_session_name,
        sessao.organization_id,
        dormir,
        12,
      );
      chats = segunda.chats;
      agenda = segunda.agenda;
    }
    const misturados = unirAgenda(chats, agenda);

    const elegiveis = misturados
      .map((c) => ({ raw: c, id: idDoChat(c), ts: timestampDoChat(c) }))
      .filter((c): c is { raw: unknown; id: string; ts: number } => Boolean(c.id))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, HISTORICO_MAX_CONTATOS);

    let contatos = 0;
    let puladas = 0;
    const contatoPorChat = new Map<string, string>();

    for (const chat of elegiveis) {
      let telefone: string | null = null;
      const lid = lidDoChatId(chat.id);
      if (lid && cliente.resolvePhoneForLid) {
        telefone = await cliente.resolvePhoneForLid(sessao.waha_session_name, lid);
      }
      const id = await upsertContatoDoHistorico(
        admin,
        sessao.organization_id,
        chat.id,
        nomeDoChat(chat.raw),
        telefone,
      );
      if (id) {
        contatos += 1;
        contatoPorChat.set(chat.id, id);
      } else {
        puladas += 1;
      }
    }

    let conversas = 0;
    let mensagens = 0;
    try {
      const fios = await puxarFiosNovos(
        admin,
        sessao,
        cliente,
        chats,
        contatoPorChat,
        deps,
        agora,
      );
      conversas = fios.conversas;
      mensagens = fios.mensagens;
    } catch (err) {
      logger.warn("historico: recorte do inbox falhou; a lista de contatos ficou", {
        organization_id: sessao.organization_id,
        channel_session_id: sessao.id,
        detail: err instanceof Error ? err.message.slice(0, 160) : "unknown",
      });
    }

    const pronto: ProgressoHistorico = {
      status: "pronto",
      iniciado_em: iniciado,
      terminado_em: agora(),
      contatos,
      conversas,
      mensagens,
      puladas,
      loja_curta: agenda.length + chats.length < LOJA_CURTA ? true : undefined,
    };
    await gravarProgresso(admin, sessao, metadataAtual, pronto);
    if (deps.auditar !== false) {
      void audit({
        action: "channel.historico_importado",
        organizationId: sessao.organization_id,
        resourceType: "channel_session",
        resourceId: sessao.id,
        metadata: { contatos, conversas, mensagens, puladas, so_contatos: conversas === 0 },
      });
    }
    return pronto;
  } catch (err) {
    const motivo =
      err instanceof WahaLojaIndisponivel
        ? MSG_LOJA
        : err instanceof Error
          ? err.message.slice(0, 200)
          : "Falha ao ler os contatos do aparelho.";
    const erro: ProgressoHistorico = {
      ...vazio,
      status: "erro",
      terminado_em: agora(),
      motivo,
    };
    await gravarProgresso(admin, sessao, metadataAtual, erro);
    logger.warn("historico: falhou", {
      organization_id: sessao.organization_id,
      channel_session_id: sessao.id,
      detail: motivo,
    });
    return erro;
  }
}

export type ResultadoImportacaoDaConversa =
  | {
      ok: true;
      mensagens: number;
      ja_existiam: number;
      lidas: number;
      conversationId: string | null;
    }
  | { ok: false; motivo: string };

export function candidatosDeChatId(c: {
  phone_number: string | null;
  wa_identity?: string | null;
  wa_lid?: string | null;
  source_metadata: unknown;
}): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  const push = (id: string | null) => {
    if (!id || chatFicaDeFora(id) || vistos.has(id)) return;
    vistos.add(id);
    saida.push(id);
  };
  push(chatIdDoContato(c));
  if (c.phone_number) {
    const digits = c.phone_number.replace(/\D/g, "");
    if (digits.length >= 8) push(`${digits}@c.us`);
  }
  if (c.wa_lid) push(`${c.wa_lid.replace(/@lid$/i, "")}@lid`);
  if (c.wa_identity?.startsWith("lid:")) push(`${c.wa_identity.slice(4)}@lid`);
  return saida;
}

async function mensagensDeTodosOsIds(
  cliente: ClienteDaLoja,
  sessao: string,
  ids: string[],
  teto = HISTORICO_MAX_MSGS_POR_CHAT,
): Promise<unknown[]> {
  const porId = new Map<string, unknown>();
  const pagina = 100;
  for (const chatId of ids) {
    for (let offset = 0; offset < teto; offset += pagina) {
      const lote = await cliente.listChatMessages(sessao, chatId, pagina, offset);
      for (const raw of lote) {
        const mid = idDaMensagem(raw);
        if (mid && !porId.has(mid)) porId.set(mid, raw);
      }
      if (lote.length < pagina) break;
    }
    if (porId.size > 0) break;
  }
  return [...porId.values()];
}

/**
 * Puxa o fio de UM contato. O recorte automático chama isto para o
 * chat recente; o dossiê chama para o arquivo inteiro daquela pessoa.
 */
export async function importarConversaDoContato(
  admin: Admin,
  sessao: SessaoParaHistorico,
  contato: {
    id: string;
    organization_id: string;
    phone_number: string | null;
    wa_identity?: string | null;
    wa_lid?: string | null;
    display_name?: string | null;
    source_metadata: unknown;
  },
  deps: DepsDoHistorico = {},
): Promise<ResultadoImportacaoDaConversa> {
  const ids = candidatosDeChatId(contato);
  if (ids.length === 0) {
    return { ok: false, motivo: "Este contato não tem WhatsApp para buscar a conversa." };
  }
  const chatId = ids[0]!;

  const cliente = deps.cliente ?? getWahaClient();
  if (!cliente) {
    return {
      ok: false,
      motivo: "A conexão de WhatsApp ainda não foi configurada nesta instalação.",
    };
  }

  try {
    await cliente.convergirConfigDaSessao(sessao.waha_session_name);
    const msgs = await mensagensDeTodosOsIds(
      cliente,
      sessao.waha_session_name,
      ids,
      deps.tetoMsgs,
    );
    const ordenadas = [...msgs].reverse();
    let gravou = 0;
    let jaExistiam = 0;
    let ultimo: {
      conversationId: string;
      direction: "inbound" | "outbound";
      preview: string;
      sentAt: string;
    } | null = null;
    const nome = contato.display_name ?? null;

    for (const raw of ordenadas) {
      const payload = mensagemDaLojaParaPayload(chatId, raw);
      if (!payload) continue;
      if (payload.fromMe !== true && !payload.from) payload.from = chatId;
      if (!payload._data && nome) payload._data = { notifyName: nome };
      const r = await ingerirMensagemHistorica(admin, sessao, payload, chatId);
      if (r.kind === "gravou") {
        gravou += 1;
        ultimo = r;
      } else if (r.kind === "dedup") {
        jaExistiam += 1;
      }
    }

    if (ultimo) {
      await carimbarConversaDoHistorico(
        admin,
        sessao.organization_id,
        ultimo.conversationId,
        ultimo.direction,
        ultimo.preview,
        ultimo.sentAt,
      );
    }

    if (deps.auditar !== false) {
      void audit({
        action: "contact.conversa_importada",
        organizationId: sessao.organization_id,
        resourceType: "contact",
        resourceId: contato.id,
        metadata: {
          channel_session_id: sessao.id,
          mensagens: gravou,
          ja_existiam: jaExistiam,
          lidas: msgs.length,
          conversation_id: ultimo?.conversationId ?? null,
        },
      });
    }

    if (ultimo?.conversationId) {
      void emitirParaParceiro(
        admin,
        sessao.organization_id,
        "conversation.opened",
        "conversation",
        ultimo.conversationId,
        { contact_id: contato.id, origem: "importar" },
      );
    }

    return {
      ok: true,
      mensagens: gravou,
      ja_existiam: jaExistiam,
      lidas: msgs.length,
      conversationId: ultimo?.conversationId ?? null,
    };
  } catch (err) {
    if (err instanceof WahaLojaIndisponivel) {
      return { ok: false, motivo: MSG_LOJA };
    }
    return {
      ok: false,
      motivo:
        err instanceof Error ? err.message.slice(0, 200) : "Não trouxe a conversa deste contato.",
    };
  }
}

/**
 * Toda vez que o número VOLTA a WORKING. Queda + reconexão não pode
 * sumir com quem já estava no aparelho — lista em Contatos e fios
 * recentes no inbox, sem esperar o cliente escrever de novo.
 *
 * Só recusa se já está rodando agora (e não travou).
 */
export async function puxarHistoricoAoConectar(
  admin: Admin,
  sessao: SessaoParaHistorico,
  deps: DepsDoHistorico = {},
): Promise<ProgressoHistorico | null> {
  const { data } = await admin
    .from("channel_sessions")
    .select("metadata")
    .eq("organization_id", sessao.organization_id)
    .eq("id", sessao.id)
    .maybeSingle();
  const atual = lerProgressoDoMetadata(data?.metadata);
  if (atual?.status === "rodando" && !historicoTravado(atual, Date.now())) {
    return null;
  }
  return puxarHistorico(admin, sessao, deps);
}

