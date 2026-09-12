import type { ProximaAcaoLinha } from "@/lib/demandas/listar-proximas-acoes";
import type { PeriodoPronto } from "@/lib/supervisao/periodo";

export type FonteDoSnapshot = "ok" | "error";

export interface AcaoDaHome {
  demanda_id: string;
  contact_id: string;
  lead_id: string | null;
  conversation_id: string | null;
  texto: string | null;
  em: string | null;
  contact_name: string;
  lead_title: string | null;
  temperatura: ProximaAcaoLinha["temperatura"];
  estado: ProximaAcaoLinha["estado"];
  quando: string | null;
  atraso: string | null;
}

export interface CompromissoDaHome {
  id: string;
  title: string;
  starts_at: string;
}

export interface EtapaDoFunilDaHome {
  stage_id: string;
  stage_name: string;
  pipeline_id: string;
  count: number;
  value_cents: number;
}

export interface EquipeDaHome {
  user_id: string;
  nome: string;
  disponivel: boolean;
  abertas: number;
}

export interface UltimaCampanhaDaHome {
  id: string;
  name: string;
  enviados: number;
  respostas: number;
  opt_outs: number;
  /** Dado real da campanha — `running` ou `completed`. Ausente = não mostrar badge. */
  status?: "running" | "completed";
}

export interface SnapshotPessoal {
  atrasadas: number;
  hoje: number;
  quentes_sem_acao: number;
  conversas_minhas: number;
  acoes: AcaoDaHome[];
  compromissos: CompromissoDaHome[];
}

export interface SnapshotEquipe {
  fila: number;
  espera_mais_antiga_s: number;
  primeira_resposta_media_s: number | null;
  conversas_abertas: number;
  disponiveis: number;
  pessoas: EquipeDaHome[];
}

export interface SnapshotComercial {
  leads_novos: number;
  oportunidades_abertas: number;
  ganhos: number;
  perdidos: number;
  conversao: number | null;
  sem_proxima_acao: number;
  atrasadas: number;
  paradas: number | null;
  /** Valores do período imediatamente anterior, mesma duração. Sem inventar. */
  vs_anterior: {
    leads_novos: number;
    ganhos: number;
    conversao: number | null;
    primeira_resposta_media_s: number | null;
  } | null;
}

export interface SnapshotDaHome {
  periodo: PeriodoPronto;
  papel: "agent" | "manager";
  personal: SnapshotPessoal;
  team: SnapshotEquipe | null;
  commercial: SnapshotComercial | null;
  funnel: EtapaDoFunilDaHome[];
  campaigns: UltimaCampanhaDaHome | null;
  pipeline_href: string;
  sources: {
    personal: FonteDoSnapshot;
    team: FonteDoSnapshot | "omit";
    commercial: FonteDoSnapshot | "omit";
    funnel: FonteDoSnapshot;
    campaigns: FonteDoSnapshot | "omit";
  };
  elapsed_ms: number;
}

export function ehGestor(role: string | null | undefined): boolean {
  return role === "manager" || role === "admin";
}
