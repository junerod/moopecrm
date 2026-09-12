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
 * - Dois canais com telefone DIFERENTE, um WORKING e outro FAILED: os dois
 *   são legítimos. A regra NÃO é "uma org, uma sessão".
 *
 * ─── O outro defeito, medido depois ────────────────────────────────────────
 *
 * O número foi reconectado numa sessão nova (WORKING). A sessão antiga ficou
 * STOPPED/FAILED COM o mesmo telefone — e, se não estava arquivada, a faixa
 * escrevia "WhatsApp 5561… está desconectado" ao lado do badge Conectado.
 * Residual não pegava: residual exige telefone vazio. Multi-número exige
 * anunciar o número B caído; o mesmo número em duas linhas não é
 * multi-número, é reconexão. A frase "este número está desconectado" só é
 * verdadeira quando NENHUMA irmã WORKING carrega esse telefone.
 *
 * ─── Como se reconhece ──────────────────────────────────────────────────────
 *
 * Residual = status que avisa (FAILED / SCAN_QR_CODE / STOPPED) + sem
 * telefone + existe outra sessão WORKING na mesma lista. Sem telefone = o
 * pareamento nunca identificou um número; com WORKING irmã = já há conexão
 * em uso. Ordem do array, created_at e nome interno não entram: residual
 * não "ganha" por ser mais nova nem por ser a primeira.
 *
 * Supersedida = residual OU (caída + o mesmo telefone em uma irmã WORKING).
 * Telefone compara só dígitos: "+55 61 94114-4879" e "556194114879" são o
 * mesmo número. Dois vazios não são o mesmo número — isso é residual.
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

/** Só dígitos — "+55 61 9…" e "5561…" são o mesmo número neste aviso. */
export function digitosDoTelefone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function irmaWorkingComEsteNumero(
  sessao: SessaoParaClassificar,
  irmas: SessaoParaClassificar[],
): boolean {
  const fone = digitosDoTelefone(sessao.phone_number);
  if (!fone) return false;
  return irmas.some(
    (s) =>
      s.id !== sessao.id &&
      (s.status ?? "").toUpperCase() === "WORKING" &&
      digitosDoTelefone(s.phone_number) === fone,
  );
}

/**
 * A faixa / a bolinha / a Central não podem tratar esta sessão como "o
 * WhatsApp caiu": ou ela nunca virou número (residual), ou o número já
 * está WORKING em outra linha.
 */
export function ehSessaoSupersedida(
  sessao: SessaoParaClassificar,
  irmas: SessaoParaClassificar[],
): boolean {
  if (ehResidualSupersedida(sessao, irmas)) return true;
  const status = (sessao.status ?? "").toUpperCase();
  if (!(STATUS_CAIDO as readonly string[]).includes(status)) return false;
  return irmaWorkingComEsteNumero(sessao, irmas);
}

/** Caídas que a faixa do topo pode anunciar — supersedida não entra. */
export function filtrarCaidasParaFaixa<T extends SessaoParaClassificar>(sessoes: T[]): T[] {
  return sessoes.filter((s) => {
    const status = (s.status ?? "").toUpperCase();
    if (!(STATUS_CAIDO as readonly string[]).includes(status)) return false;
    return !ehSessaoSupersedida(s, sessoes);
  });
}
