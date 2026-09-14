import { destinatarioPodeReceberNoCanal } from "@/lib/campanhas/consentimento";
import { rotearContato } from "@/lib/campanhas/canais";
import type {
  CanalDaCampanha,
  ContatoParaSegmento,
  SegmentoDaCampanha,
  SelecaoDeCanais,
} from "@/lib/campanhas/tipos";
import { canaisDaSelecao, segmentoVazio } from "@/lib/campanhas/tipos";

export interface ExclusoesDoSegmento {
  bloqueados: number;
  opt_out: number;
  sem_whatsapp: number;
  sem_email: number;
  sem_canal: number;
}

export interface EstimativaDoSegmento {
  selecionados: number;
  elegiveis: number;
  excluidos: number;
  ids: string[];
  exclusoes: ExclusoesDoSegmento;
  atinge_base_inteira: boolean;
  destinos: number;
}

function temTag(contato: ContatoParaSegmento, tags: string[]): boolean {
  const atuais = new Set((contato.tags ?? []).map((t) => t.toLowerCase()));
  return tags.some((t) => atuais.has(t.toLowerCase()));
}

export function contatoCasaNoSegmento(
  contato: ContatoParaSegmento,
  segmento: SegmentoDaCampanha,
): boolean {
  if (segmento.contact_ids && segmento.contact_ids.length > 0) {
    if (!segmento.contact_ids.includes(contato.id)) return false;
  }
  if (segmento.tags && segmento.tags.length > 0 && !temTag(contato, segmento.tags)) {
    return false;
  }
  if (segmento.papel && contato.papel !== segmento.papel) return false;
  if (segmento.origem && contato.source !== segmento.origem) return false;
  if (segmento.owner_user_id && contato.owner_user_id !== segmento.owner_user_id) {
    return false;
  }
  if (segmento.pipeline_id && contato.pipeline_id !== segmento.pipeline_id) return false;
  if (segmento.stage_id && contato.stage_id !== segmento.stage_id) return false;
  if (segmento.temperatura && contato.temperatura !== segmento.temperatura) return false;
  return true;
}

export function estimarSegmento(
  contatos: ContatoParaSegmento[],
  segmento: SegmentoDaCampanha,
  selecao: SelecaoDeCanais = "whatsapp",
  totalDaBase?: number,
): EstimativaDoSegmento {
  const casados = contatos.filter((c) => contatoCasaNoSegmento(c, segmento));
  const exclusoes: ExclusoesDoSegmento = {
    bloqueados: 0,
    opt_out: 0,
    sem_whatsapp: 0,
    sem_email: 0,
    sem_canal: 0,
  };
  const elegiveis: ContatoParaSegmento[] = [];
  let destinos = 0;
  const canais = canaisDaSelecao(selecao);

  for (const c of casados) {
    const rota = rotearContato(c, selecao);
    if (!rota.ignorado) {
      elegiveis.push(c);
      destinos += rota.destinos.length;
      continue;
    }
    if (rota.motivo === "contact_blocked") exclusoes.bloqueados += 1;
    else if (rota.motivo === "consent_declined") exclusoes.opt_out += 1;
    else {
      exclusoes.sem_canal += 1;
      if (canais.includes("whatsapp") && !destinatarioPodeReceberNoCanal(c, "whatsapp").ok) {
        exclusoes.sem_whatsapp += 1;
      }
      if (canais.includes("email") && !destinatarioPodeReceberNoCanal(c, "email").ok) {
        exclusoes.sem_email += 1;
      }
    }
  }

  const excluidos = casados.length - elegiveis.length;
  const atinge_base_inteira =
    segmentoVazio(segmento) &&
    (totalDaBase == null ? casados.length > 0 : casados.length >= totalDaBase && totalDaBase > 0);

  return {
    selecionados: casados.length,
    elegiveis: elegiveis.length,
    excluidos,
    ids: casados.map((c) => c.id),
    exclusoes,
    atinge_base_inteira,
    destinos,
  };
}

export function rotuloDaEstimativa(est: EstimativaDoSegmento): string {
  return `${est.elegiveis} contatos encontrados`;
}

export function canaisPedidos(_selecao: SelecaoDeCanais): CanalDaCampanha[] {
  return canaisDaSelecao(_selecao);
}
