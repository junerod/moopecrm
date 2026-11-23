/**
 * A pergunta de carro não espera o modelo lembrar da ferramenta.
 *
 * Na Absoluta a pessoa perguntava se a Saveiro estava livre e a resposta era
 * "vou verificar com a equipe", sem a consulta sair. Este módulo lê a mensagem,
 * chama a gestão e devolve a frase que o turno cola na frente do modelo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  consultarDisponibilidade,
  listarOferta,
  type AlternativaDeFrota,
  type OfertaItem,
  type ResultadoDisponibilidade,
  type ResultadoOferta,
} from "@/lib/moope/cliente-locadora";

const PARADA = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "em", "no", "na",
  "nos", "nas", "para", "pra", "pro", "por", "com", "sem", "que", "se", "e", "ou",
  "esta", "estar", "estao", "livre", "livres", "disponivel", "disponiveis",
  "alugado", "alugada", "alugados", "alocado", "alocada", "carro", "carros",
  "veiculo", "veiculos", "quanto", "fica", "ficam", "mes", "dia", "dias", "semana",
  "semanal", "mensal", "diario", "diaria", "valor", "preco", "voces", "tem", "ter",
  "quero", "queria", "gostaria", "alugar", "locar", "locacao", "periodo", "data",
  "datas", "ate", "entre", "ao", "outro", "outra", "escolher", "verificar", "equipe",
  "respondo", "logo", "mais", "oi", "ola", "bom", "boa", "tarde", "noite", "favor",
  "me", "te", "voce", "ele", "ela", "esse", "essa", "isso", "nao", "sim", "ta", "vai",
  "disponibilidade", "horario", "pode", "poderia", "saber", "dizer", "informar",
  "consulta", "consultar", "reservado", "reservada",
  "pessoas", "pessoa", "lugares", "lugar", "cabe", "cabem", "caber",
  "volta", "voltam", "voltar", "libera", "liberar", "quando", "quantos", "quantas",
]);

export interface PerguntaDeFrota {
  q: string | null;
  inicio: string | null;
  fim: string | null;
  querPreco: boolean;
  querDisponibilidade: boolean;
  /** “para 5 pessoas” / “5 lugares”. Sem o número, a pergunta não é de lugares. */
  lugares: number | null;
  /** “quando volta” / “quando libera”. */
  querVolta: boolean;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
}

/** Ano omitido no passado vira o ano que vem. "28/11" em 23/11/2026 continua 2026. */
function completarData(dia: number, mes: number, ano: number | null, hoje: Date): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const informado = ano == null ? null : ano < 100 ? 2000 + ano : ano;
  let y = informado ?? hoje.getFullYear();
  if (!dataValida(y, mes, dia)) return null;
  if (informado == null) {
    const hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const candidata = new Date(y, mes - 1, dia);
    if (candidata < hoje0) {
      y += 1;
      if (!dataValida(y, mes, dia)) return null;
    }
  }
  return iso(y, mes, dia);
}

function datasDaMensagem(texto: string, hoje: Date): string[] {
  const achadas: string[] = [];
  const re = /\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?\b/g;
  for (const m of texto.matchAll(re)) {
    const isoData = completarData(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, hoje);
    if (isoData) achadas.push(isoData);
  }
  return achadas;
}

function nomeDoCarro(texto: string): string | null {
  const semDatas = texto.replace(/\b\d{1,2}\s*[/\-.]\s*\d{1,2}(?:\s*[/\-.]\s*\d{2,4})?\b/g, " ");
  const tokens = semDatas.match(/[\p{L}\p{N}]+/gu) ?? [];
  const nomes: string[] = [];
  for (const token of tokens) {
    const chave = semAcento(token);
    if (PARADA.has(chave) || chave.length < 3) continue;
    nomes.push(token);
    if (nomes.length === 3) break;
  }
  if (nomes.length === 0) return null;
  return nomes.join(" ").slice(0, 80);
}

/** 1 a 20 pessoas ou lugares. “5 dias” não entra. */
function lugaresDaMensagem(texto: string): number | null {
  const n = semAcento(texto);
  const padroes = [
    /\b(\d{1,2})\s*(?:pessoas|pessoa|lugares|lugar)\b/,
    /\b(?:cabem|cabe)\s*(\d{1,2})\b/,
    /\b(?:para|pra)\s*(\d{1,2})\s*(?:pessoas|pessoa|lugares|lugar)\b/,
  ];
  for (const re of padroes) {
    const m = n.match(re);
    const num = m ? Number(m[1]) : NaN;
    if (Number.isInteger(num) && num >= 1 && num <= 20) return num;
  }
  return null;
}

export function lerPerguntaDeFrota(texto: string, hoje: Date): PerguntaDeFrota | null {
  const q = nomeDoCarro(texto);
  const datas = datasDaMensagem(texto, hoje);
  const ordenadas = [...datas].sort();
  const inicio = ordenadas[0] ?? null;
  const fim = ordenadas.length >= 2 ? ordenadas[ordenadas.length - 1]! : inicio;
  const n = semAcento(texto);
  const lugares = lugaresDaMensagem(texto);
  const querVolta = /\b(?:volta|voltam|voltar|libera|liberar)\b/.test(n);
  const querDisponibilidade =
    datas.length > 0 || /disponiv|livre|alugad|alocad|reserv/.test(n);
  const querPreco = /quanto|valor|preco|mensal|semanal|diari/.test(n) || /\bmes\b/.test(n);
  if (!q && lugares == null && !querVolta) return null;
  if (!querDisponibilidade && !querPreco && lugares == null && !querVolta) return null;
  return { q, inicio, fim, querPreco, querDisponibilidade, lugares, querVolta };
}

function reais(n: number): string {
  const fixo = n.toFixed(2);
  const ponto = fixo.indexOf(".");
  const inteiro = fixo.slice(0, ponto);
  const frac = fixo.slice(ponto + 1);
  const mil = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${mil},${frac}`;
}

function diaBr(isoData: string): string {
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function periodo(inicio: string, fim: string): string {
  if (inicio === fim) return `no dia ${diaBr(inicio)}`;
  return `de ${diaBr(inicio)} a ${diaBr(fim)}`;
}

function nomesDasAlternativas(itens: AlternativaDeFrota[]): string {
  return itens
    .map((item) => {
      const precos = [
        item.valor_diario != null ? `${reais(item.valor_diario)}/dia` : null,
        item.valor_semanal != null ? `${reais(item.valor_semanal)}/semana` : null,
        item.valor_mensal != null ? `${reais(item.valor_mensal)}/mês` : null,
      ].filter((p): p is string => Boolean(p));
      return precos.length > 0 ? `${item.modelo} (${precos.join(", ")})` : item.modelo;
    })
    .join("; ");
}

export function fraseDaDisponibilidade(
  pergunta: PerguntaDeFrota,
  resultado: ResultadoDisponibilidade,
): string {
  const quando =
    pergunta.inicio && pergunta.fim ? periodo(pergunta.inicio, pergunta.fim) : "nesse período";
  if (!resultado.ok || resultado.situacao === "consulta_indisponivel") {
    return (
      `A consulta ao Frotas sobre ${pergunta.q} ${quando} não voltou sim nem não. ` +
      "Aí pode dizer que vai verificar com a equipe, com as datas já ditas."
    );
  }
  if (resultado.situacao === "disponivel") {
    const preco = resultado.preco != null ? ` O valor informado é ${reais(resultado.preco)}.` : "";
    return (
      `Consulta ao Frotas desta mensagem: ${pergunta.q} está disponível ${quando}.${preco} ` +
      "Responda agora que está disponível. Não diga que vai verificar com a equipe."
    );
  }
  const outros = nomesDasAlternativas(resultado.alternativas);
  const oferta = outros
    ? `Ofereça só estes: ${outros}.`
    : "A frota não apontou outro carro. Não invente um modelo.";
  const volta =
    resultado.volta_em != null ? ` Volta em ${diaBr(resultado.volta_em)}.` : "";
  return (
    `Consulta ao Frotas desta mensagem: ${pergunta.q} não está disponível ${quando}.${volta} ` +
    `Responda agora que não está disponível e pergunte se a pessoa quer escolher outro. ${oferta} ` +
    "Não diga que vai verificar com a equipe."
  );
}

export function fraseDosLugares(
  lugares: number,
  resultado: ResultadoOferta,
): string {
  if (!resultado.ok || resultado.itens.length === 0) {
    return (
      `A consulta de carro para ${lugares} pessoas não voltou frota. ` +
      "Não invente um modelo. Aí pode dizer que vai verificar com a equipe."
    );
  }
  const comNumero = resultado.itens.filter((item) => item.lugares != null);
  if (comNumero.length === 0) {
    return (
      `A ficha não trouxe quantos lugares. Não invente um carro para ${lugares} pessoas. ` +
      "Aí pode dizer que vai verificar com a equipe."
    );
  }
  const cabem = comNumero.filter((item) => (item.lugares ?? 0) >= lugares);
  if (cabem.length === 0) {
    const veio = comNumero
      .map((item) => `${item.modelo} (${item.lugares} lugares)`)
      .join("; ");
    return (
      `Nenhum carro devolvido cabe ${lugares} pessoas. Os que vieram: ${veio}. Não invente outro.`
    );
  }
  const linhas = cabem.slice(0, 4).map((item) => `${item.modelo} (${item.lugares} lugares)`);
  return (
    `Para ${lugares} pessoas a gestão devolveu: ${linhas.join("; ")}. ` +
    "Fale só estes. Não diga que vai verificar com a equipe."
  );
}

export function fraseDaVolta(q: string | null, resultado: ResultadoOferta): string {
  const quem = q ?? "o carro";
  if (!resultado.ok || resultado.itens.length === 0) {
    return (
      `A consulta de quando ${quem} volta não trouxe data. ` +
      "Não invente o dia. Aí pode dizer que vai verificar com a equipe."
    );
  }
  const comData = resultado.itens.filter((item) => item.volta_em != null);
  if (comData.length === 0) {
    return (
      `A ficha não trouxe o dia em que ${quem} volta. Não invente a data. ` +
      "Aí pode dizer que vai verificar com a equipe."
    );
  }
  const linhas = comData
    .slice(0, 4)
    .map((item) => `${item.modelo} volta em ${diaBr(item.volta_em!)}`);
  return (
    `A gestão devolveu a volta: ${linhas.join("; ")}. ` +
    "Fale só essa data. Não diga que vai verificar com a equipe."
  );
}

function precoDoItem(item: OfertaItem, pedido: string): string | null {
  if (/\bmes\b|mensal/.test(pedido)) {
    return item.valor_mensal != null ? `${reais(item.valor_mensal)} no mês` : null;
  }
  if (/semanal/.test(pedido)) {
    return item.valor_semanal != null ? `${reais(item.valor_semanal)} na semana` : null;
  }
  if (/diari/.test(pedido)) {
    return item.valor_diario != null ? `${reais(item.valor_diario)} por dia` : null;
  }
  if (item.valor_mensal != null) return `${reais(item.valor_mensal)} no mês`;
  if (item.valor_diario != null) return `${reais(item.valor_diario)} por dia`;
  if (item.valor_semanal != null) return `${reais(item.valor_semanal)} na semana`;
  return null;
}

export function fraseDoPreco(q: string, pedido: string, resultado: ResultadoOferta): string {
  if (!resultado.ok || resultado.itens.length === 0) {
    return (
      `A consulta de preço da ${q} no Frotas não voltou valor. ` +
      "Não invente número. Aí pode dizer que vai verificar com a equipe."
    );
  }
  const n = semAcento(pedido);
  const linhas = resultado.itens.slice(0, 4).map((item) => {
    const valor = precoDoItem(item, n);
    return valor ? `${item.modelo}: ${valor}` : `${item.modelo}: a ficha não trouxe esse valor`;
  });
  return (
    `Consulta ao Frotas desta mensagem, preço de ${q}: ${linhas.join("; ")}. ` +
    "Fale só o valor que veio. Campo vazio não vira número. Não diga que vai verificar com a equipe."
  );
}

export async function blocoDaPerguntaDeFrota(
  admin: SupabaseClient,
  orgId: string,
  texto: string,
  hoje: Date,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<string> {
  const pergunta = lerPerguntaDeFrota(texto, hoje);
  if (!pergunta) return "";
  const partes: string[] = [];
  if (pergunta.querDisponibilidade && pergunta.q) {
    if (!pergunta.inicio || !pergunta.fim) {
      partes.push(
        `A pessoa perguntou da ${pergunta.q} sem dizer as datas. Peça o dia de início e o de fim. Não diga que vai verificar com a equipe.`,
      );
    } else {
      const disp = await consultarDisponibilidade(
        admin,
        orgId,
        { inicio: pergunta.inicio, fim: pergunta.fim, q: pergunta.q },
        deps,
      );
      partes.push(fraseDaDisponibilidade(pergunta, disp));
    }
  }
  if (pergunta.querPreco && pergunta.q) {
    const oferta = await listarOferta(admin, orgId, deps, { q: pergunta.q });
    partes.push(fraseDoPreco(pergunta.q, semAcento(texto), oferta));
  }
  if (pergunta.lugares != null) {
    const oferta = await listarOferta(admin, orgId, deps, {
      q: pergunta.q ?? undefined,
      lugares: pergunta.lugares,
    });
    partes.push(fraseDosLugares(pergunta.lugares, oferta));
  }
  if (pergunta.querVolta && !pergunta.querDisponibilidade) {
    const oferta = await listarOferta(admin, orgId, deps, {
      q: pergunta.q ?? undefined,
      visao: pergunta.q ? undefined : "alugados_fim",
    });
    partes.push(fraseDaVolta(pergunta.q, oferta));
  }
  return partes.join("\n");
}
