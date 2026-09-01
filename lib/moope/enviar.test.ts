import { describe, expect, it, vi } from "vitest";

import {
  acharContato,
  escolherDestinoDoEnvio,
  enviarPeloCrm,
  traduzirDesfecho,
} from "@/lib/moope/enviar";

function pedido() {
  return {
    external_id: "9",
    phone: "+5561999999999",
    body: "Sua fatura: https://exemplo/f",
    idempotency_key: "fatura:9:hoje",
  };
}

describe("traduzirDesfecho do disparo MOOPE", () => {
  it("sent vira 200", () => {
    const r = traduzirDesfecho({ id: "m1", status: "sent" }, "c1");
    expect(r).toEqual({
      ok: true,
      status: 200,
      message_id: "m1",
      conversation_id: "c1",
    });
  });

  it("pacing vira 429", () => {
    const r = traduzirDesfecho(
      { id: "m1", status: "failed", error_code: "rate_limited", error_message: "429" },
      "c1",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(429);
  });

  it("janela/template vira 422", () => {
    const r = traduzirDesfecho(
      { id: "m1", status: "failed", error_code: "TEMPLATE_REQUIRED", error_message: "131047" },
      "c1",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });
});

describe("escolherDestinoDoEnvio", () => {
  const locadora = {
    id: "ct-mop",
    phone_number: "+5561996715985",
    is_blocked: false,
    wa_identity: null,
    wa_lid: null,
  };
  const whatsapp = {
    id: "ct-wa",
    phone_number: "+556196715985",
    is_blocked: false,
    wa_identity: "phone:+556196715985",
    wa_lid: "235587596492898",
  };

  it("ficha da locadora cede ao gêmeo que já tem LID", () => {
    expect(escolherDestinoDoEnvio([locadora, whatsapp])?.id).toBe("ct-wa");
  });

  it("bloqueio de qualquer ficha do par vence", () => {
    expect(
      escolherDestinoDoEnvio([{ ...locadora, is_blocked: true }, whatsapp])?.is_blocked,
    ).toBe(true);
  });

  it("sem gêmeo do WhatsApp segue na ficha da locadora", () => {
    expect(escolherDestinoDoEnvio([locadora])?.id).toBe("ct-mop");
  });
});

function contactsAdmin(opts: {
  porMeta?: { id: string; phone_number: string | null; is_blocked: boolean } | null;
  porFone?: Array<{
    id: string;
    phone_number: string | null;
    is_blocked: boolean;
    wa_identity?: string | null;
    wa_lid?: string | null;
  }>;
}) {
  return {
    from: (tabela: string) => {
      if (tabela !== "contacts") throw new Error(tabela);
      const chain: Record<string, unknown> = {};
      const self = {
        select: () => self,
        eq: () => self,
        in: () => self,
        is: () => self,
        limit: () => self,
        maybeSingle: async () => ({ data: opts.porMeta ?? null }),
        then: (resolve: (v: { data: unknown }) => void) =>
          resolve({ data: opts.porFone ?? [] }),
      };
      Object.assign(chain, self);
      return chain;
    },
  };
}

describe("acharContato", () => {
  it("prefere moope_external_id e não cria linha", async () => {
    const admin = contactsAdmin({
      porMeta: { id: "ct-1", phone_number: "+5561", is_blocked: false },
    });
    const c = await acharContato(admin as never, "org", "9", "+5561999999999");
    expect(c?.id).toBe("ct-1");
  });

  it("gêmeo com LID vence a ficha da locadora", async () => {
    const admin = contactsAdmin({
      porMeta: { id: "ct-mop", phone_number: "+5561996715985", is_blocked: false },
      porFone: [
        { id: "ct-mop", phone_number: "+5561996715985", is_blocked: false },
        {
          id: "ct-wa",
          phone_number: "+556196715985",
          is_blocked: false,
          wa_lid: "235587596492898",
        },
      ],
    });
    const c = await acharContato(admin as never, "org", "1", "+5561996715985");
    expect(c?.id).toBe("ct-wa");
  });

  it("sem ficha devolve null — 404, não inventa contato", async () => {
    const admin = contactsAdmin({ porMeta: null, porFone: [] });
    const c = await acharContato(admin as never, "org", "9", "+5561999999999");
    expect(c).toBeNull();
  });
});

describe("enviarPeloCrm", () => {
  it("sem contato → 404 e não chama o envio", async () => {
    const enviarMensagem = vi.fn();
    const contatos = contactsAdmin({ porMeta: null, porFone: [] });
    const admin = {
      from: (tabela: string) => {
        if (tabela === "idempotency_keys") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null }) }),
                }),
              }),
            }),
          };
        }
        return contatos.from(tabela);
      },
    };
    const r = await enviarPeloCrm(admin as never, "org", pedido(), "req-1", { enviarMensagem });
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it("contato bloqueado → 409 sem enviar", async () => {
    const enviarMensagem = vi.fn();
    const contatos = contactsAdmin({
      porMeta: { id: "ct-1", phone_number: "+5561", is_blocked: true },
    });
    const admin = {
      from: (tabela: string) => {
        if (tabela === "idempotency_keys") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null }) }),
                }),
              }),
            }),
          };
        }
        return contatos.from(tabela);
      },
    };
    const r = await enviarPeloCrm(admin as never, "org", pedido(), "req-1", { enviarMensagem });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it("reenvio com a mesma chave devolve o cache e não manda de novo", async () => {
    const enviarMensagem = vi.fn();
    const admin = {
      from: (tabela: string) => {
        if (tabela === "idempotency_keys") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        response_body: { message_id: "m-old", conversation_id: "cv-1" },
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`não deveria ler ${tabela}`);
      },
    };
    const r = await enviarPeloCrm(admin as never, "org", pedido(), "req-1", { enviarMensagem });
    expect(r).toEqual({
      ok: true,
      status: 200,
      message_id: "m-old",
      conversation_id: "cv-1",
      deduplicado: true,
    });
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it("freio do número devolve 429 e não fala no WhatsApp", async () => {
    const enviarMensagem = vi.fn();
    const avaliarDisparo = vi.fn(async () => ({
      ok: false as const,
      retry_after: 5,
      message: "O número ainda está no intervalo de segurança.",
    }));
    const contatos = contactsAdmin({
      porMeta: { id: "ct-1", phone_number: "+5561", is_blocked: false },
    });
    const admin = {
      from: (tabela: string) => {
        if (tabela === "idempotency_keys") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null }) }),
                }),
              }),
            }),
          };
        }
        return contatos.from(tabela);
      },
    };
    const r = await enviarPeloCrm(admin as never, "org", pedido(), "req-1", {
      enviarMensagem,
      avaliarDisparo,
      sessao: { id: "s1", provider: "waha" },
    });
    expect(r).toMatchObject({ ok: false, status: 429, retry_after: 5 });
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

});
