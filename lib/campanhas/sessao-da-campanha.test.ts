import { describe, expect, it } from "vitest";

import {
  escolherSessaoParaCampanha,
  sessaoApareceNasOpcoesDaCampanha,
} from "@/lib/campanhas/sessao-da-campanha";
import type { ChannelProvider } from "@/lib/channels/types";

function sess(
  id: string,
  status: string,
  phone: string,
  provider: ChannelProvider,
) {
  return { id, status, phone_number: phone, provider };
}

describe("sessão da campanha", () => {
  const qrViva = sess("qr-viva", "WORKING", "5561941144879", "waha");
  const qrMorta = sess("qr-morta", "STOPPED", "5561941144879", "waha");
  const oficial = sess("oficial", "WORKING", "5511999990000", "zernio");

  it("sem escolha: prefere o número do celular WORKING", () => {
    expect(escolherSessaoParaCampanha(null, [oficial, qrViva])?.id).toBe("qr-viva");
  });

  it("QR caído sobe na irmã WORKING do mesmo número", () => {
    expect(escolherSessaoParaCampanha(qrMorta, [qrMorta, qrViva])?.id).toBe("qr-viva");
  });

  it("oficial escolhida permanece", () => {
    expect(escolherSessaoParaCampanha(oficial, [oficial, qrViva])?.id).toBe("oficial");
  });

  it("opções listam oficial e QR WORKING, não QR morto", () => {
    expect(sessaoApareceNasOpcoesDaCampanha(oficial)).toBe(true);
    expect(sessaoApareceNasOpcoesDaCampanha(qrViva)).toBe(true);
    expect(sessaoApareceNasOpcoesDaCampanha(qrMorta)).toBe(false);
  });
});
