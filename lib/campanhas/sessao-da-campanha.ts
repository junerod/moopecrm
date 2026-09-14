/**
 * Qual sessão a campanha usa. Oficial escolhida fica. QR caído sobe na
 * irmã WORKING do mesmo número. Sem escolha, a primeira WORKING.
 */
import { campanhaComercialRealPermitida } from "@/lib/campanhas/capabilities";
import {
  escolherSessaoVivaParaEnvio,
  sessaoEstaProntaParaEnvio,
  type SessaoParaEnvio,
} from "@/lib/channels/sessao-viva-para-envio";
import type { ChannelProvider } from "@/lib/channels/types";

export type SessaoDaCampanha = SessaoParaEnvio & {
  provider: ChannelProvider;
};

export function escolherSessaoParaCampanha(
  pedida: SessaoDaCampanha | null,
  irmas: SessaoDaCampanha[],
): SessaoDaCampanha | null {
  if (pedida && campanhaComercialRealPermitida(pedida.provider)) return pedida;
  const viva = escolherSessaoVivaParaEnvio(pedida, irmas) as SessaoDaCampanha | null;
  if (viva) return viva;
  const qrViva = irmas.find(
    (s) => sessaoEstaProntaParaEnvio(s) && !campanhaComercialRealPermitida(s.provider),
  );
  if (qrViva) return qrViva;
  return irmas.find((s) => sessaoEstaProntaParaEnvio(s)) ?? null;
}

export function sessaoApareceNasOpcoesDaCampanha(sessao: {
  provider: ChannelProvider;
  status?: string | null;
}): boolean {
  if (campanhaComercialRealPermitida(sessao.provider)) return true;
  return (sessao.status ?? "").toUpperCase() === "WORKING";
}
