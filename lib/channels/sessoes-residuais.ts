/**
 * Sessão residual — a que sobrou de um pareamento que nunca virou número.
 *
 * ─── O defeito, medido ──────────────────────────────────────────────────────
 *
 * Uma organização tinha a sessão viva em WORKING e, ao lado, a linha do
 * onboarding (`org_<8 chars>`) em FAILED / SCAN_QR_CODE, sem telefone. A faixa
 * do topo lia só as caídas, ignorava a WORKING, e escrevia "WhatsApp sem nome
 * está desconectado — nenhuma mensagem entra nem sai" + "Escanear o QR". O
 * operador concluía que o número em uso tinha caído e era induzido a gerar QR
 * numa conexão que já funcionava.
 *
 * ─── O que NÃO é residual ───────────────────────────────────────────────────
 *
 * - Número real que caiu: tem `phone_number`. Multi-número exige que esse
 *   canal continue aparecendo como caído — a WORKING irmã não o apaga.
 * - Pareamento em curso sem irmã WORKING: SCAN_QR_CODE / FAILED sozinhos são
 *   o fluxo de conectar o primeiro (ou único) número. Escondê-los mascararia
 *   falha real.
 * - Dois canais com telefone, um WORKING e outro FAILED: os dois são
 *   legítimos. A regra NÃO é "uma org, uma sessão".
 *
 * ─── Como se reconhece ──────────────────────────────────────────────────────
 *
 * Residual = status que avisa (FAILED / SCAN_QR_CODE / STOPPED) + sem
 * telefone + existe outra sessão WORKING na mesma lista. Sem telefone = o
 * pareamento nunca identificou um número; com WORKING irmã = já há conexão
 * em uso. Ordem do array, created_at e nome interno não entram: residual
 * não "ganha" por ser mais nova nem por ser a primeira.
 *
 * A lista de status caídos é a MESMA de `STATUS_QUE_AVISAM` em `./health`
 * (o teste ao lado reprova se divergir). Não importamos de lá: health
 * consome este arquivo, e o ciclo quebraria o boot.
 */
const STATUS_CAIDO = ["SCAN_QR_CODE", "FAILED", "STOPPED"] as const;

export interface SessaoParaClassificar {
  id: string;
  status: string | null;
  phone_number?: string | null;
}

export function orgTemSessaoWorking(sessoes: SessaoParaClassificar[]): boolean {
  return sessoes.some((s) => (s.status ?? "").toUpperCase() === "WORKING");
}

export function ehResidualSupersedida(
  sessao: SessaoParaClassificar,
  irmas: SessaoParaClassificar[],
): boolean {
  const status = (sessao.status ?? "").toUpperCase();
  if (!(STATUS_CAIDO as readonly string[]).includes(status)) return false;
  if ((sessao.phone_number ?? "").trim()) return false;
  return irmas.some(
    (s) => s.id !== sessao.id && (s.status ?? "").toUpperCase() === "WORKING",
  );
}

/** Caídas que a faixa do topo pode anunciar — residual não entra. */
export function filtrarCaidasParaFaixa<T extends SessaoParaClassificar>(sessoes: T[]): T[] {
  return sessoes.filter((s) => {
    const status = (s.status ?? "").toUpperCase();
    if (!(STATUS_CAIDO as readonly string[]).includes(status)) return false;
    return !ehResidualSupersedida(s, sessoes);
  });
}
