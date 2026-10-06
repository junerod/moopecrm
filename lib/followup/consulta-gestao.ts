/**
 * Bloco "Consultar gestão" do bot.
 *
 * O texto que o cliente recebe é montado só com campo que a gestão devolveu.
 * Preço, placa, boleto e atraso ausentes não viram frase. Falha, conexão
 * ausente ou cadastro que não casa devolvem `achou: false` — o quadro segue
 * pelo ramo "Não encontrou", que a publicação exige ligado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  consultarFinanceiro,
  getRetratoInvestidor,
  getRetratoLocatario,
  listarOferta,
  lookupInvestidor,
  lookupLocatario,
  obterSegundaVia,
  type OfertaItem,
  type ParcelaResumo,
  type RetratoLocatario,
} from "@/lib/moope/cliente-locadora";
import type { FonteDeConsulta } from "@/lib/followup/graph-schema";

export interface ResultadoDaConsulta {
  achou: boolean;
  texto: string;
}

const VAZIO: ResultadoDaConsulta = { achou: false, texto: "" };

const TETO_ITENS = 8;
const TETO_CHARS = 1200;

function reais(n: number): string {
  const fixo = n.toFixed(2);
  const ponto = fixo.indexOf(".");
  const inteiro = fixo.slice(0, ponto);
  const frac = fixo.slice(ponto + 1);
  const mil = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${mil},${frac}`;
}

function linkOficial(url: string | null): string | null {
  if (!url) return null;
  return /^https:\/\//i.test(url) ? url : null;
}

function cortar(texto: string): string {
  const limpo = texto.trim();
  if (limpo.length <= TETO_CHARS) return limpo;
  return `${limpo.slice(0, TETO_CHARS - 1).trimEnd()}…`;
}

function pronto(linhas: string[]): ResultadoDaConsulta {
  const texto = cortar(linhas.filter((l) => l.trim().length > 0).join("\n"));
  if (!texto) return VAZIO;
  return { achou: true, texto };
}

function statusDaOferta(status: string | null): string | null {
  if (status === "DISPONIVEL") return "disponível";
  if (status === "ALUGADO") return "alugado";
  if (status === "RESERVADO") return "reservado";
  return null;
}

export function textoDaOferta(itens: OfertaItem[]): ResultadoDaConsulta {
  if (itens.length === 0) return VAZIO;
  const linhas = ["Veículos na gestão:"];
  const mostra = itens.slice(0, TETO_ITENS);
  for (const item of mostra) {
    const partes = [item.modelo];
    const situacao = statusDaOferta(item.status);
    if (situacao) partes.push(situacao);
    if (item.valor_diario != null) partes.push(`${reais(item.valor_diario)}/dia`);
    if (item.valor_semanal != null) partes.push(`${reais(item.valor_semanal)}/semana`);
    if (item.valor_mensal != null) partes.push(`${reais(item.valor_mensal)}/mês`);
    if (item.opcionais) partes.push(item.opcionais);
    linhas.push(`• ${partes.join(" — ")}`);
  }
  if (itens.length > TETO_ITENS) {
    linhas.push(`e mais ${itens.length - TETO_ITENS}.`);
  }
  return pronto(linhas);
}

export function textoDoCliente(nome: string, contratoStatus: string | null): ResultadoDaConsulta {
  const quem = nome.trim();
  if (!quem) return VAZIO;
  const linhas = [`Encontrei o cadastro de ${quem}.`];
  if (contratoStatus?.trim()) linhas.push(`Contrato: ${contratoStatus.trim()}.`);
  return pronto(linhas);
}

export function textoDaSituacao(retrato: RetratoLocatario): ResultadoDaConsulta {
  const linhas: string[] = [];
  if (retrato.nome.trim()) linhas.push(retrato.nome.trim());
  const carro = [retrato.veiculo_modelo, retrato.placa].filter((p): p is string => Boolean(p?.trim()));
  if (carro.length > 0) linhas.push(carro.join(" · "));
  if (retrato.contrato_titulo?.trim()) linhas.push(retrato.contrato_titulo.trim());
  if (retrato.contrato_status?.trim()) linhas.push(`Contrato: ${retrato.contrato_status.trim()}.`);
  if (retrato.amount_cents != null && retrato.amount_cents > 0) {
    linhas.push(`Em aberto: ${reais(retrato.amount_cents / 100)}.`);
  }
  if (retrato.days_late != null && retrato.days_late > 0) {
    linhas.push(`Atraso de ${retrato.days_late} dias.`);
  }
  const boleto = linkOficial(retrato.boleto_url) ?? linkOficial(retrato.invoice_url);
  if (boleto) linhas.push(`Boleto: ${boleto}`);
  const portal = linkOficial(retrato.portal_url);
  if (portal) linhas.push(`Portal: ${portal}`);
  return pronto(linhas);
}

export function textoDoFinanceiro(entrada: {
  parcelas: ParcelaResumo[];
  boleto_url: string | null;
  pix_url: string | null;
  portal_url: string | null;
}): ResultadoDaConsulta {
  const linhas: string[] = [];
  const parcelas = entrada.parcelas.slice(0, TETO_ITENS);
  if (parcelas.length > 0) linhas.push("Financeiro:");
  for (const p of parcelas) {
    const partes: string[] = [];
    if (p.vencimento?.trim()) partes.push(p.vencimento.trim());
    if (p.valor != null) partes.push(reais(p.valor));
    if (p.status?.trim()) partes.push(p.status.trim());
    if (p.atraso_dias != null && p.atraso_dias > 0) partes.push(`atraso de ${p.atraso_dias} dias`);
    if (partes.length > 0) linhas.push(`• ${partes.join(" — ")}`);
  }
  if (entrada.parcelas.length > TETO_ITENS) {
    linhas.push(`e mais ${entrada.parcelas.length - TETO_ITENS}.`);
  }
  const boleto = linkOficial(entrada.boleto_url);
  if (boleto) linhas.push(`Boleto: ${boleto}`);
  const pix = linkOficial(entrada.pix_url);
  if (pix) linhas.push(`PIX: ${pix}`);
  const portal = linkOficial(entrada.portal_url);
  if (portal) linhas.push(`Portal: ${portal}`);
  return pronto(linhas);
}

export function textoDoBoleto(entrada: {
  boleto_url: string | null;
  pix_url: string | null;
  portal_url: string | null;
}): ResultadoDaConsulta {
  const linhas: string[] = [];
  const boleto = linkOficial(entrada.boleto_url);
  const pix = linkOficial(entrada.pix_url);
  if (boleto) linhas.push(`Segunda via do boleto: ${boleto}`);
  if (pix) linhas.push(`PIX: ${pix}`);
  if (!boleto && !pix) {
    const portal = linkOficial(entrada.portal_url);
    if (portal) linhas.push(`Portal: ${portal}`);
  }
  return pronto(linhas);
}

export function textoDoInvestidor(
  nome: string,
  ultimoPeriodo: string | null,
  portalUrl: string | null,
): ResultadoDaConsulta {
  const quem = nome.trim();
  if (!quem) return VAZIO;
  const linhas = [`Encontrei o investidor ${quem}.`];
  if (ultimoPeriodo?.trim()) linhas.push(`Último período: ${ultimoPeriodo.trim()}.`);
  const portal = linkOficial(portalUrl);
  if (portal) linhas.push(`Portal: ${portal}`);
  return pronto(linhas);
}

export async function executarConsultaDoBot(
  admin: SupabaseClient,
  orgId: string,
  phone: string | null,
  fonte: FonteDeConsulta,
): Promise<ResultadoDaConsulta> {
  if (fonte === "oferta") {
    const oferta = await listarOferta(admin, orgId);
    if (!oferta.ok) return VAZIO;
    return textoDaOferta(oferta.itens);
  }

  const numero = phone?.trim() ?? "";
  if (!numero) return VAZIO;

  if (fonte === "investidor") {
    const inv = await lookupInvestidor(admin, orgId, { phone: numero });
    if (!inv.ok) return VAZIO;
    const retrato = await getRetratoInvestidor(admin, orgId, inv.investidor_id);
    if (!retrato.ok) return textoDoInvestidor(inv.nome, null, null);
    return textoDoInvestidor(
      retrato.nome.trim() || inv.nome,
      retrato.ultimo_periodo,
      retrato.portal_url,
    );
  }

  const quem = await lookupLocatario(admin, orgId, { phone: numero });
  if (!quem.ok) return VAZIO;

  if (fonte === "cliente") return textoDoCliente(quem.nome, quem.contrato_status);

  if (fonte === "situacao") {
    const retrato = await getRetratoLocatario(admin, orgId, quem.locatario_id);
    if (!retrato.ok) return VAZIO;
    return textoDaSituacao(retrato);
  }

  if (fonte === "boleto") {
    const via = await obterSegundaVia(admin, orgId, quem.locatario_id);
    if (!via.ok) return VAZIO;
    return textoDoBoleto(via);
  }

  const financeiro = await consultarFinanceiro(admin, orgId, quem.locatario_id);
  if (!financeiro.ok) return VAZIO;
  return textoDoFinanceiro(financeiro);
}
