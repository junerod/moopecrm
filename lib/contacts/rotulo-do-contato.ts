/**
 * COMO SE CHAMA ESTA PESSOA NA TELA — uma decisão, um lugar.
 *
 * ═══ POR QUE CENTRALIZAR ═══
 *
 * A mesma cadeia `display_name || name || phone_number || <literal>` estava
 * copiada em **seis** arquivos, com **quatro** finais diferentes (`Sem nome`,
 * `Contato sem nome`, `—`, `—`) e duas variações de conteúdo: a ficha do contato
 * e a tabela de contatos **não usavam o telefone**, então quem tinha número mas
 * não tinha nome aparecia como "Sem nome" numa tela e com o número em outra.
 *
 * Seis cópias não divergem por descuido — divergem porque cada tela nova
 * reescreve a cadeia do jeito que parece certo naquele arquivo. A sétima ia
 * nascer com um quinto final.
 *
 * ═══ A REGRA QUE NENHUMA DELAS TINHA ═══
 *
 * **Identificador técnico não é nome de gente.** `Contato 543134@lid` esteve na
 * tela do atendente da produção; o produtor daquela string morreu, mas o dado
 * ficou, e o passo seguinte da spec 17 vai LER o nome do contato para escrever o
 * título do card no kanban — sem esta guarda, o resíduo vaza para o quadro.
 *
 * E o consumidor não é só humano: `lib/ai/render-system-prompt.ts` põe o nome do
 * contato no prompt do modelo. Um rótulo técnico ali é a mesma doença que a spec
 * 16 mediu em 30% dos turnos — vocabulário de máquina chegando ao cliente.
 */

/** O que qualquer tela precisa saber para chamar alguém pelo nome. */
export interface ContatoNomeavel {
  id?: string | null;
  display_name?: string | null;
  name?: string | null;
  phone_number?: string | null;
  /**
   * O que a ingestão gravou quando a coluna “oficial” não podia receber.
   * `notify_name` é o pushName do WhatsApp; `telefone_em_conflito` é o número
   * que já pertencia a OUTRO contato da org (cadastro MOOPE, import, formulário)
   * — a RPC recusa gravar o telefone no stub @lid para não estourar a unique,
   * e sem esta leitura o Inbox mostra “Sem nome” para a mesma pessoa que
   * Contatos já lista com nome e número.
   */
  source_metadata?: {
    notify_name?: unknown;
    telefone_em_conflito?: unknown;
    waha_chat_id?: unknown;
  } | null;
}

/** Quando não há nada apresentável. Um literal, não quatro. */
export const SEM_NOME = "Sem nome";

function textoDoMeta(
  meta: ContatoNomeavel["source_metadata"],
  chave: "notify_name" | "telefone_em_conflito" | "waha_chat_id",
): string {
  if (!meta || typeof meta !== "object") return "";
  const v = meta[chave];
  return typeof v === "string" ? v.trim() : "";
}

function telefoneDeChatId(id: string): string | null {
  const baixo = id.toLowerCase();
  if (!baixo.endsWith("@c.us") && !baixo.endsWith("@s.whatsapp.net")) return null;
  const digits = id.replace(/@.*$/, "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/**
 * PostgREST devolve o embed many-to-one ora como objeto, ora como array de um.
 * Ler `.display_name` num array é `undefined` — e a lista inteira vira “Sem nome”
 * mesmo com o cadastro preenchido. Uma função, os dois formatos.
 */
export function contatoDoEmbed<T extends ContatoNomeavel>(
  bruto: T | T[] | null | undefined,
): T | null {
  if (!bruto) return null;
  if (Array.isArray(bruto)) return bruto[0] ?? null;
  return bruto;
}

/** Tem nome de gente — não telefone, não id técnico, não vazio. */
export function temNomeApresentavel(c: ContatoNomeavel | null | undefined): boolean {
  if (!c) return false;
  const notify = textoDoMeta(c.source_metadata, "notify_name");
  for (const bruto of [c.display_name, c.name, notify]) {
    const v = (bruto ?? "").trim();
    if (v !== "" && !ehIdentificadorTecnico(v)) return true;
  }
  return false;
}

/**
 * O número que dá para mostrar (ou cruzar com o cadastro que já tem nome).
 * Inclui o que a RPC guardou em metadata quando o telefone já era de outro.
 */
export function telefoneApresentavel(c: ContatoNomeavel | null | undefined): string {
  if (!c) return "";
  for (const t of [c.phone_number, textoDoMeta(c.source_metadata, "telefone_em_conflito")]) {
    const v = (t ?? "").trim();
    if (v !== "") return v;
  }
  return telefoneDeChatId(textoDoMeta(c.source_metadata, "waha_chat_id")) ?? "";
}

/**
 * Cheira a identificador de máquina?
 *
 * Conservador de propósito: recusar um nome legítimo é pior que deixar passar um
 * técnico, porque o primeiro apaga a identidade de uma pessoa real. Por isso as
 * âncoras — `Contato 5431` sai, `Contato Comercial da Loja` fica.
 */
export function ehIdentificadorTecnico(valor: string): boolean {
  const v = valor.trim();
  if (v === "") return true;
  // Sufixos de endereçamento do WhatsApp em qualquer posição.
  if (/@(lid|c\.us|s\.whatsapp\.net|g\.us)\b/i.test(v)) return true;
  // O rótulo que o código antigo inventava: "Contato " + dígitos, e só isso.
  if (/^contato\s+\d+$/i.test(v)) return true;
  // Só dígitos e longo demais para ser apelido — é id, não nome. Telefone
  // formatado (com +, espaço ou hífen) NÃO cai aqui: ele é um rótulo útil e tem
  // caminho próprio abaixo.
  if (/^\d{9,}$/.test(v)) return true;
  return false;
}

/**
 * O rótulo. Primeiro o que uma pessoa escolheu, depois o que o canal informou,
 * depois o número — e só então a admissão de que não se sabe o nome.
 *
 * O telefone NÃO é reformatado: ele já é gravado em E.164 e é o mesmo texto que
 * o atendente copia para ligar ou buscar. Embelezá-lo aqui mudaria um rótulo
 * visível sem que ninguém tenha pedido.
 */
export function rotuloDoContato(c: ContatoNomeavel | null | undefined): string {
  if (!c) return SEM_NOME;

  const notify = textoDoMeta(c.source_metadata, "notify_name");
  const candidatos = [c.display_name, c.name, notify];
  for (const bruto of candidatos) {
    const v = (bruto ?? "").trim();
    if (v !== "" && !ehIdentificadorTecnico(v)) return v;
  }

  const tel = telefoneApresentavel(c);
  // O telefone escapa da recusa acima de propósito: "5531988887777" é
  // identificador para a regra de nome, e é informação ÚTIL para quem atende —
  // muito melhor que "Sem nome".
  if (tel !== "") return tel;

  return SEM_NOME;
}
