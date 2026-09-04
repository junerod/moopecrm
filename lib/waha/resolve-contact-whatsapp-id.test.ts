import { describe, expect, it, vi } from "vitest";

import { wahaContactPayload } from "@/lib/waha/contact-card";
import {
  chatIdFromCheckResult,
  destinoDeEnvioWaha,
  resolveCanonicalSendChatId,
  resolveWhatsappIdForContactCard,
  whatsappIdFromCheckResult,
} from "@/lib/waha/resolve-contact-whatsapp-id";

describe("whatsappIdFromCheckResult", () => {
  it("prefere pn sobre chatId", () => {
    expect(
      whatsappIdFromCheckResult({
        numberExists: true,
        pn: "553198966398@c.us",
        chatId: "70192801575156@lid",
      }),
    ).toBe("553198966398");
  });

  it("extrai dígitos de chatId @c.us", () => {
    expect(
      whatsappIdFromCheckResult({
        numberExists: true,
        chatId: "5531998966398@c.us",
      }),
    ).toBe("5531998966398");
  });
});

describe("chatIdFromCheckResult — envio usa o JID do canal", () => {
  it("chatId vence pn: o nono canônico é o do WhatsApp, não o do cadastro", () => {
    expect(
      chatIdFromCheckResult({
        numberExists: true,
        pn: "5561996715985@c.us",
        chatId: "556196715985@c.us",
      }),
    ).toBe("556196715985@c.us");
  });
});

describe("resolveCanonicalSendChatId", () => {
  it("número com o 9 resolve para o @c.us sem o 9 que o WhatsApp devolve", async () => {
    const client = {
      checkContactExists: vi.fn().mockResolvedValue({
        numberExists: true,
        chatId: "556196715985@c.us",
      }),
    };
    const r = await resolveCanonicalSendChatId(client as never, "s1", "+5561996715985");
    expect(r).toEqual({ consultou: true, existe: true, chatId: "556196715985@c.us" });
  });

  it("@c.us com o 9 vira o JID sem o 9; @lid não mexe", async () => {
    const client = {
      checkContactExists: vi.fn().mockResolvedValue({
        numberExists: true,
        chatId: "556196715985@c.us",
      }),
    };
    expect(await destinoDeEnvioWaha(client as never, "s1", "5561996715985@c.us")).toBe(
      "556196715985@c.us",
    );
    expect(await destinoDeEnvioWaha(client as never, "s1", "235587596492898@lid")).toBe(
      "235587596492898@lid",
    );
    expect(client.checkContactExists).toHaveBeenCalledTimes(1);
  });

  it("consulta falhou em todas as variantes → não afirma que não existe", async () => {
    const client = {
      checkContactExists: vi.fn().mockRejectedValue(new Error("rede")),
    };
    const r = await resolveCanonicalSendChatId(client as never, "s1", "+5561996715985");
    expect(r.consultou).toBe(false);
    expect(r.chatId).toBeNull();
  });
});

describe("resolveWhatsappIdForContactCard", () => {
  it("tenta variantes BR e usa a primeira que existir", async () => {
    const client = {
      checkContactExists: vi
        .fn()
        .mockResolvedValueOnce({ numberExists: false })
        .mockResolvedValueOnce({ numberExists: true, pn: "553198966398@c.us" }),
    };

    const id = await resolveWhatsappIdForContactCard(
      client as never,
      "sessao-1",
      "+5531998966398",
    );

    expect(id).toBe("553198966398");
    expect(client.checkContactExists).toHaveBeenCalledTimes(2);
  });

  it("retorna null quando nenhuma variante existe", async () => {
    const client = {
      checkContactExists: vi.fn().mockResolvedValue({ numberExists: false }),
    };

    const id = await resolveWhatsappIdForContactCard(
      client as never,
      "sessao-1",
      "+5531998966398",
    );

    expect(id).toBeNull();
  });
});

describe("wahaContactPayload com wa_id resolvido", () => {
  it("alinha phoneNumber e waid ao id canônico de 12 dígitos", () => {
    const p = wahaContactPayload("Maria", "+5531998966398", "553198966398");
    expect(p.whatsappId).toBe("553198966398");
    expect(p.phoneNumber).toBe("+553198966398");
    expect(p.vcard).toContain("waid=553198966398");
    expect(p.vcard).toContain("+553198966398");
  });
});
