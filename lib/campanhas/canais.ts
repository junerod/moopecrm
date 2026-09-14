import { destinatarioPodeReceberNoCanal } from "@/lib/campanhas/consentimento";
import type {
  CanalDaCampanha,
  ContatoParaSegmento,
  SelecaoDeCanais,
} from "@/lib/campanhas/tipos";
import { canaisDaSelecao } from "@/lib/campanhas/tipos";

export interface DestinoPorCanal {
  canal: CanalDaCampanha;
  destination: string;
}

export interface RoteamentoDoContato {
  destinos: DestinoPorCanal[];
  ignorado: boolean;
  motivo: string | null;
}

/**
 * Um contato com os dois dados e campanha "ambos" gera dois destinos.
 * Só telefone → WhatsApp. Só e-mail → e-mail. Nenhum → ignorado.
 */
export function rotearContato(
  contato: ContatoParaSegmento,
  selecao: SelecaoDeCanais,
): RoteamentoDoContato {
  const destinos: DestinoPorCanal[] = [];
  const motivos: string[] = [];
  for (const canal of canaisDaSelecao(selecao)) {
    const r = destinatarioPodeReceberNoCanal(contato, canal);
    if (r.ok) destinos.push({ canal, destination: r.destination });
    else motivos.push(r.reason);
  }
  if (destinos.length === 0) {
    return {
      destinos: [],
      ignorado: true,
      motivo: motivos[0] ?? "no_channel",
    };
  }
  return { destinos, ignorado: false, motivo: null };
}

export interface DisponibilidadeDeCanal {
  whatsapp: { conectado: boolean; rotulo: string; session_id: string | null };
  email: { configurado: boolean; rotulo: string };
}

export function rotuloDisponibilidadeWhatsapp(conectado: boolean): string {
  return conectado ? "Conectado" : "Não conectado";
}

export function rotuloDisponibilidadeEmail(configurado: boolean): string {
  return configurado ? "Configurado" : "Não configurado";
}
