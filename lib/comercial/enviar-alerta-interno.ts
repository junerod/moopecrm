import {
  CLASSIFICACAO_ALERTA_INTERNO,
  montarMensagemAlerta,
  type KindDeAlerta,
} from "@/lib/comercial/alerta-interno";

/**
 * Provider de alerta INTERNO ao atendente.
 *
 * Nesta rodada: mock. Não chama WAHA, não cria conversation, não cria message,
 * não muda owner, não muda AI_MODE, não passa por campanha.
 *
 * Destinatário = E.164 do ATENDENTE. Nunca o telefone do cliente.
 */
export interface EntregaDeAlertaInterno {
  classificacao: typeof CLASSIFICACAO_ALERTA_INTERNO;
  dest_e164: string;
  demanda_id: string;
  kind: KindDeAlerta;
  texto: string;
  via: "mock";
}

export function enviarAlertaInternoMock(entrada: {
  destE164: string;
  demandaId: string;
  kind: KindDeAlerta;
  contactName: string;
  textoAcao: string;
  em: string;
  agora?: Date;
}): EntregaDeAlertaInterno {
  return {
    classificacao: CLASSIFICACAO_ALERTA_INTERNO,
    dest_e164: entrada.destE164,
    demanda_id: entrada.demandaId,
    kind: entrada.kind,
    texto: montarMensagemAlerta({
      kind: entrada.kind,
      contactName: entrada.contactName,
      texto: entrada.textoAcao,
      em: entrada.em,
      agora: entrada.agora,
    }),
    via: "mock",
  };
}
