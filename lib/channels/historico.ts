/**
 * Porta do legado do aparelho — a rota e a tela NÃO nomeiam o
 * transporte. Quem sabe ler a loja mora em `lib/waha/historico`.
 *
 * Lista de Contatos + recorte de fios novos no inbox. O arquivo
 * inteiro de um contato continua sob pedido no dossiê.
 *
 * organization_id chega de quem já autenticou (cookie). Nunca do body.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { fraseDaFalhaDeCanal } from "@/lib/channels/frases-de-falha";
import type { ProgressoHistorico } from "@/lib/channels/historico-tipos";
import {
  historicoTravado,
  importarConversaDoContato,
  lerProgressoDoMetadata,
  puxarHistorico,
  type SessaoParaHistorico,
} from "@/lib/waha/historico";
import { getWahaClient } from "@/lib/waha/client";

/** Quatro minutos: o cron de 5 não pisa no clique que acabou de rodar. */
export const INTERVALO_SYNC_CONTATOS_MS = 4 * 60 * 1000;

export function historicoAindaFresco(
  p: ProgressoHistorico | null,
  agoraMs: number,
  intervaloMs = INTERVALO_SYNC_CONTATOS_MS,
): boolean {
  if (!p || p.status !== "pronto") return false;
  const t = Date.parse(p.terminado_em ?? p.iniciado_em);
  if (!Number.isFinite(t)) return false;
  return agoraMs - t < intervaloMs;
}

export type { ProgressoHistorico };

export type FalhaDoHistorico =
  | "nao_encontrado"
  | "arquivado"
  | "sem_sessao"
  | "sem_transporte"
  | "nao_conectado"
  | "em_andamento"
  | "falha";

export type LeituraDoHistorico =
  | { ok: true; progresso: ProgressoHistorico | null; statusDoCanal: string }
  | { ok: false; codigo: FalhaDoHistorico; mensagem: string };

export type InicioDoHistorico =
  | { ok: true; progresso: ProgressoHistorico }
  | { ok: false; codigo: FalhaDoHistorico; mensagem: string };

type LinhaCanal = {
  id: string;
  organization_id: string;
  status: string | null;
  waha_session_name: string | null;
  archived_at?: string | null;
  metadata: unknown;
};

async function carregarCanal(
  orgId: string,
  sessionId: string,
): Promise<LinhaCanal | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("channel_sessions")
    .select("id, organization_id, status, waha_session_name, archived_at, metadata")
    .eq("organization_id", orgId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LinhaCanal;
}

function sessaoDaLinha(linha: LinhaCanal): SessaoParaHistorico | null {
  if (!linha.waha_session_name) return null;
  return {
    id: linha.id,
    organization_id: linha.organization_id,
    waha_session_name: linha.waha_session_name,
  };
}

export async function lerHistoricoDoCanal(
  orgId: string,
  sessionId: string,
): Promise<LeituraDoHistorico> {
  const linha = await carregarCanal(orgId, sessionId);
  if (!linha) {
    return { ok: false, codigo: "nao_encontrado", mensagem: "Canal não encontrado." };
  }
  if (linha.archived_at) {
    return {
      ok: false,
      codigo: "arquivado",
      mensagem: "Este número foi excluído da Central de Conexões.",
    };
  }
  return {
    ok: true,
    progresso: lerProgressoDoMetadata(linha.metadata),
    statusDoCanal: (linha.status ?? "").toUpperCase(),
  };
}

export async function iniciarHistoricoDoCanal(
  orgId: string,
  sessionId: string,
): Promise<InicioDoHistorico> {
  const linha = await carregarCanal(orgId, sessionId);
  if (!linha) {
    return { ok: false, codigo: "nao_encontrado", mensagem: "Canal não encontrado." };
  }
  if (linha.archived_at) {
    return {
      ok: false,
      codigo: "arquivado",
      mensagem: "Este número foi excluído da Central de Conexões.",
    };
  }
  const sessao = sessaoDaLinha(linha);
  if (!sessao) {
    return {
      ok: false,
      codigo: "sem_sessao",
      mensagem:
        "Este canal não tem sessão de aparelho para ler os contatos. O número oficial só conhece o que chegar depois de conectado.",
    };
  }
  if ((linha.status ?? "").toUpperCase() !== "WORKING") {
    return {
      ok: false,
      codigo: "nao_conectado",
      mensagem:
        "Conecte o WhatsApp antes de trazer os contatos. O número precisa estar no ar.",
    };
  }
  if (!getWahaClient()) {
    return {
      ok: false,
      codigo: "sem_transporte",
      mensagem:
        fraseDaFalhaDeCanal("waha_not_configured") ??
        "A conexão de WhatsApp ainda não foi configurada nesta instalação.",
    };
  }

  const atual = lerProgressoDoMetadata(linha.metadata);
  if (atual && !historicoTravado(atual, Date.now())) {
    if (atual.status === "rodando") {
      return {
        ok: false,
        codigo: "em_andamento",
        mensagem: "Já estamos trazendo os contatos deste número. Espere terminar.",
      };
    }
  }

  const admin = createAdminClient();
  const progresso = await puxarHistorico(admin, sessao, { pedirAgendaCompleta: true });
  if (progresso.status === "erro") {
    return { ok: false, codigo: "falha", mensagem: progresso.motivo ?? "Não trouxe os contatos." };
  }
  return { ok: true, progresso };
}

export type ImportacaoDaConversa =
  | {
      ok: true;
      mensagens: number;
      ja_existiam: number;
      lidas: number;
      conversation_id: string | null;
    }
  | { ok: false; codigo: FalhaDoHistorico; mensagem: string };

async function sessaoWorkingDaOrg(orgId: string): Promise<SessaoParaHistorico | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("channel_sessions")
    .select("id, organization_id, waha_session_name, status, archived_at")
    .eq("organization_id", orgId)
    .eq("status", "WORKING")
    .order("created_at", { ascending: true });
  const linha = (data ?? []).find(
    (s) => !s.archived_at && typeof s.waha_session_name === "string" && s.waha_session_name,
  );
  if (!linha?.waha_session_name) return null;
  return {
    id: linha.id,
    organization_id: linha.organization_id,
    waha_session_name: linha.waha_session_name,
  };
}

/**
 * Importa o fio de UM contato. organization_id vem de quem autenticou.
 */
export async function iniciarImportacaoDaConversa(
  orgId: string,
  contactId: string,
): Promise<ImportacaoDaConversa> {
  if (!getWahaClient()) {
    return {
      ok: false,
      codigo: "sem_transporte",
      mensagem:
        fraseDaFalhaDeCanal("waha_not_configured") ??
        "A conexão de WhatsApp ainda não foi configurada nesta instalação.",
    };
  }

  const sessao = await sessaoWorkingDaOrg(orgId);
  if (!sessao) {
    return {
      ok: false,
      codigo: "nao_conectado",
      mensagem: "Conecte o WhatsApp antes de importar a conversa. O número precisa estar no ar.",
    };
  }

  const admin = createAdminClient();
  const { data: contato, error } = await admin
    .from("contacts")
    .select(
      "id, organization_id, phone_number, wa_identity, wa_lid, display_name, name, source_metadata, is_anonymized, is_merged_into",
    )
    .eq("organization_id", orgId)
    .eq("id", contactId)
    .maybeSingle();

  if (error || !contato) {
    return { ok: false, codigo: "nao_encontrado", mensagem: "Contato não encontrado." };
  }
  if (contato.is_anonymized || contato.is_merged_into) {
    return {
      ok: false,
      codigo: "falha",
      mensagem: "Este contato não pode receber conversa importada.",
    };
  }

  const r = await importarConversaDoContato(admin, sessao, {
    id: contato.id,
    organization_id: contato.organization_id,
    phone_number: contato.phone_number,
    wa_identity: contato.wa_identity,
    wa_lid: contato.wa_lid,
    display_name: contato.display_name ?? contato.name,
    source_metadata: contato.source_metadata,
  });

  if (!r.ok) {
    return { ok: false, codigo: "falha", mensagem: r.motivo };
  }
  return {
    ok: true,
    mensagens: r.mensagens,
    ja_existiam: r.ja_existiam,
    lidas: r.lidas,
    conversation_id: r.conversationId,
  };
}

export type ResultadoDoLoteDeContatos = {
  sessoes: number;
  puxadas: number;
  puladas: number;
  novos: number;
  erros: number;
  conversas: number;
};

type Admin = ReturnType<typeof createAdminClient>;

async function contarPessoasDaOrg(admin: Admin, orgId: string): Promise<number> {
  const { count } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_anonymized", false);
  return count ?? 0;
}

/**
 * Número no ar → Contatos e o recorte recente do inbox acompanham
 * o aparelho, sem reconectar e sem ninguém estar olhando a tela.
 */
export async function sincronizarContatosDosCanaisNoAr(deps: {
  agoraMs?: number;
  admin?: Admin;
  puxar?: (admin: Admin, sessao: SessaoParaHistorico) => Promise<ProgressoHistorico>;
} = {}): Promise<ResultadoDoLoteDeContatos> {
  const admin = deps.admin ?? createAdminClient();
  const agoraMs = deps.agoraMs ?? Date.now();
  const puxar =
    deps.puxar ?? ((a, s) => puxarHistorico(a, s, { auditar: false }));

  const vazio: ResultadoDoLoteDeContatos = {
    sessoes: 0,
    puxadas: 0,
    puladas: 0,
    novos: 0,
    erros: 0,
    conversas: 0,
  };

  const { data, error } = await admin
    .from("channel_sessions")
    .select("id, organization_id, status, waha_session_name, archived_at, metadata")
    .eq("status", "WORKING")
    .is("archived_at", null)
    .limit(30);

  if (error || !data) return vazio;

  const resumo = { ...vazio };
  for (const linha of data as LinhaCanal[]) {
    const sessao = sessaoDaLinha(linha);
    if (!sessao) continue;
    resumo.sessoes += 1;
    const atual = lerProgressoDoMetadata(linha.metadata);
    if (atual?.status === "rodando" && !historicoTravado(atual, agoraMs)) {
      resumo.puladas += 1;
      continue;
    }
    if (historicoAindaFresco(atual, agoraMs)) {
      resumo.puladas += 1;
      continue;
    }
    const antes = await contarPessoasDaOrg(admin, sessao.organization_id);
    const progresso = await puxar(admin, sessao);
    if (progresso.status === "erro") {
      resumo.erros += 1;
      continue;
    }
    resumo.puxadas += 1;
    const depois = await contarPessoasDaOrg(admin, sessao.organization_id);
    resumo.novos += Math.max(0, depois - antes);
    resumo.conversas += progresso.conversas ?? 0;
  }
  return resumo;
}

/**
 * Reconectar para o transporte e só depois puxa a lista — a loja ainda
 * não responde no instante do stop+start.
 */
export async function puxarHistoricoAposReligamento(
  orgId: string,
  sessionId: string,
  deps: {
    dormir?: (ms: number) => Promise<void>;
    tentativas?: number;
    iniciar?: typeof iniciarHistoricoDoCanal;
  } = {},
): Promise<InicioDoHistorico> {
  const dormir = deps.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const iniciar = deps.iniciar ?? iniciarHistoricoDoCanal;
  const tentativas = deps.tentativas ?? 8;
  let ultimo: InicioDoHistorico = {
    ok: false,
    codigo: "nao_conectado",
    mensagem: "O número ainda não voltou ao ar para trazer os contatos.",
  };
  for (let i = 0; i < tentativas; i++) {
    await dormir(2_000);
    ultimo = await iniciar(orgId, sessionId);
    if (ultimo.ok || ultimo.codigo === "em_andamento") return ultimo;
    if (ultimo.codigo !== "nao_conectado") return ultimo;
  }
  return ultimo;
}
