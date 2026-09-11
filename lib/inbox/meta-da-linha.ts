import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { ROTULO_DO_PAPEL, type PapelDoContato } from "@/lib/crm/papel-e-temperatura";

export type LeadDaLinha = {
  id: string;
  status: string;
  temperatura?: string | null;
  stage_id?: string | null;
  crm_stages?: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

export type DemandaDaLinha = {
  proximo_passo?: string | null;
  proximo_passo_em?: string | null;
  estado?: string | null;
};

export type MetaDaLinha = {
  etapa: string | null;
  passo: string | null;
  quando: string | null;
  atrasado: boolean;
  semPasso: boolean;
};

const DEMANDA_ABERTA = new Set(["aberta", "em_atendimento", "aguardando_cliente"]);

function nomeDaEtapa(
  stages: LeadDaLinha["crm_stages"],
): string | null {
  if (!stages) return null;
  const row = Array.isArray(stages) ? stages[0] : stages;
  const nome = row?.name?.trim();
  return nome || null;
}

function rotuloQuando(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hora = format(d, "HH:mm");
  if (isToday(d)) return `hoje ${hora}`;
  if (isTomorrow(d)) return `amanhã ${hora}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

function leadAberto(leads: LeadDaLinha[] | null | undefined): LeadDaLinha | null {
  return (leads ?? []).find((l) => l.status === "open") ?? null;
}

function demandaComPasso(
  demandas: DemandaDaLinha[] | null | undefined,
): DemandaDaLinha | null {
  const abertas = (demandas ?? []).filter((d) => !d.estado || DEMANDA_ABERTA.has(d.estado));
  const comTexto = abertas.filter((d) => (d.proximo_passo ?? "").trim().length > 0);
  if (comTexto.length === 0) return null;
  return (
    [...comTexto].sort((a, b) => {
      const ta = a.proximo_passo_em ? new Date(a.proximo_passo_em).getTime() : Infinity;
      const tb = b.proximo_passo_em ? new Date(b.proximo_passo_em).getTime() : Infinity;
      return ta - tb;
    })[0] ?? null
  );
}

/**
 * Terceira linha da lista: etapa · próximo passo, só quando há o que dizer.
 * Não inventa dado — se o embed não trouxe passo, declara "sem próximo passo".
 */
export function metaDaLinha(entrada: {
  papel?: string | null;
  crm_leads?: LeadDaLinha[] | null;
  demandas?: DemandaDaLinha[] | null;
}): MetaDaLinha | null {
  const lead = leadAberto(entrada.crm_leads);
  const demanda = demandaComPasso(entrada.demandas);
  const etapaDoLead = lead ? nomeDaEtapa(lead.crm_stages) : null;
  const papel = entrada.papel as PapelDoContato | null | undefined;
  const etapaDoPapel =
    !etapaDoLead && (papel === "lead" || papel === "cliente")
      ? papel === "lead"
        ? "Novo lead"
        : ROTULO_DO_PAPEL.cliente
      : null;
  const etapa = etapaDoLead ?? etapaDoPapel;

  const passo = demanda?.proximo_passo?.trim() || null;
  const quando = rotuloQuando(demanda?.proximo_passo_em);
  const atrasado = Boolean(
    demanda?.proximo_passo_em && new Date(demanda.proximo_passo_em).getTime() < Date.now(),
  );

  if (!etapa && !passo) return null;

  return {
    etapa,
    passo,
    quando,
    atrasado,
    semPasso: Boolean(lead || etapa) && !passo,
  };
}
