import { describe, expect, it } from "vitest";

import { envelopeEhDirect, parseDirectWebhook } from "./webhook";

const DM = {
  object: "instagram",
  entry: [
    {
      id: "17841400000",
      time: 1_700_000_000,
      messaging: [
        {
          sender: { id: "igsid-ana" },
          recipient: { id: "17841400000" },
          timestamp: 1_700_000_000_123,
          message: { mid: "mid.1", text: "quero o carro" },
        },
      ],
    },
  ],
};

describe("parseDirectWebhook", () => {
  it("lê a DM e ignora o envelope de WhatsApp", () => {
    const eventos = parseDirectWebhook(DM);
    expect(eventos).toEqual([
      expect.objectContaining({
        kind: "inbound_message",
        accountId: "17841400000",
        from: "igsid-ana",
        externalId: "mid.1",
        text: "quero o carro",
      }),
    ]);
    expect(envelopeEhDirect({ object: "whatsapp_business_account", entry: [] })).toBe(false);
    expect(parseDirectWebhook({ object: "whatsapp_business_account", entry: [] })).toEqual([]);
  });

  it("eco do próprio envio não vira mensagem do cliente", () => {
    const eventos = parseDirectWebhook({
      object: "instagram",
      entry: [
        {
          id: "17841400000",
          messaging: [
            {
              sender: { id: "17841400000" },
              timestamp: 1,
              message: { mid: "mid.echo", text: "ok", is_echo: true },
            },
          ],
        },
      ],
    });
    expect(eventos).toEqual([{ kind: "echo", externalId: "mid.echo" }]);
  });

  it("payload capenga não estoura — a plataforma reentrega o que falha", () => {
    expect(parseDirectWebhook({ object: "instagram", entry: [{ id: "x" }] })).toEqual([]);
  });
});
