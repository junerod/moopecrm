import { destinatarioPodeReceberCampanha } from "@/lib/campanhas/consentimento";
import type { ContatoParaSegmento, SegmentoDaCampanha } from "@/lib/campanhas/tipos";

export interface EstimativaDoSegmento {
  selecionados: number;
  elegiveis: number;
  excluidos: number;
  ids: string[];
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
): EstimativaDoSegmento {
  const casados = contatos.filter((c) => contatoCasaNoSegmento(c, segmento));
  const elegiveis = casados.filter((c) => destinatarioPodeReceberCampanha(c).ok);
  return {
    selecionados: casados.length,
    elegiveis: elegiveis.length,
    excluidos: casados.length - elegiveis.length,
    ids: casados.map((c) => c.id),
  };
}
