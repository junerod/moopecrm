import { describe, expect, it } from "vitest";

import { enviarWhatsappDaCampanha } from "@/lib/channels/campaign-send";

const db = {} as never;

describe("envio WhatsApp da campanha", () => {
  it("QR frio sem fio existente continua recusado", async () => {
    const r = await enviarWhatsappDaCampanha(db, {
      organizationId: "o1",
      provider: "waha",
      sessionRef: "s1",
      to: "5511999990001",
      body: "Oi",
    });
    expect(r).toEqual({ ok: false, reason: "qr_nao_dispara_campanha", via: "real" });
  });
});
