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

  const soIdentidadeTelefone = {
    id: "ct-sem-9",
    phone_number: "+556196715985",
    is_blocked: false,
    wa_identity: "phone:+556196715985",
    wa_lid: null,
  };

  it("ficha da locadora cede ao gêmeo que já tem LID", () => {
    expect(escolherDestinoDoEnvio([locadora, whatsapp], locadora.phone_number)?.id).toBe(
      "ct-wa",
    );
  });

  it("bloqueio de qualquer ficha do par vence", () => {
    expect(
      escolherDestinoDoEnvio([{ ...locadora, is_blocked: true }, whatsapp], locadora.phone_number)
        ?.is_blocked,
    ).toBe(true);
  });

  it("sem gêmeo do WhatsApp segue na ficha da locadora", () => {
    expect(escolherDestinoDoEnvio([locadora], locadora.phone_number)?.id).toBe("ct-mop");
  });

  it("gêmeo só com wa_identity phone: não rouba o número com o 9", () => {
    expect(
      escolherDestinoDoEnvio([locadora, soIdentidadeTelefone], locadora.phone_number)?.id,
    ).toBe("ct-mop");
  });

  it("sem ficha do telefone pedido e sem LID → null, para criar com o 9", () => {
    expect(escolherDestinoDoEnvio([soIdentidadeTelefone], locadora.phone_number)).toBeNull();
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
      porMeta: { id: "ct-1", phone_number: "+5561999999999", is_blocked: false },
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

  it("sem ficha devolve null — quem manda cria a ficha", async () => {
    const admin = contactsAdmin({ porMeta: null, porFone: [] });
    const c = await acharContato(admin as never, "org", "9", "+5561999999999");
    expect(c).toBeNull();
  });
});

function adminSemIdempotencia(contatos: { from: (t: string) => unknown }) {
  return {
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
          insert: async () => ({ error: null }),
        };
      }
      if (tabela === "conversations") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: null }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "cv-1" }, error: null }),
            }),
          }),
        };
        return chain;
      }
      return contatos.from(tabela);
    },
  };
}

describe("enviarPeloCrm", () => {
  it("telefone inválido → 422 e não cria ficha", async () => {
    const enviarMensagem = vi.fn();
    const criarPessoa = vi.fn();
    const r = await enviarPeloCrm(
      { from: () => { throw new Error("não deveria ler banco"); } } as never,
      "org",
      { ...pedido(), phone: "abc" },
      "req-1",
      { enviarMensagem, criarPessoa },
    );
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(criarPessoa).not.toHaveBeenCalled();
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it("sem contato cria a ficha; se a criação falhar, 503 e não envia", async () => {
    const enviarMensagem = vi.fn();
    const criarPessoa = vi.fn(async () => null);
    const contatos = contactsAdmin({ porMeta: null, porFone: [] });
    const r = await enviarPeloCrm(
      adminSemIdempotencia(contatos) as never,
      "org",
      pedido(),
      "req-1",
      { enviarMensagem, criarPessoa },
    );
    expect(criarPessoa).toHaveBeenCalledWith(
      expect.anything(),
      "org",
      expect.objectContaining({ phone: "+5561999999999", external_id: "9" }),
    );
    expect(r).toMatchObject({ ok: false, status: 503 });
    if (!r.ok) expect(r.message).not.toMatch(/person\.upserted/);
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it("número fora da agenda: cria ficha com o 9 e manda", async () => {
    const enviarMensagem = vi.fn(async () => ({ id: "m-novo", status: "sent" }));
    const criarPessoa = vi.fn(async () => "ct-novo");
    const registrarDisparo = vi.fn(async () => undefined);
    const contatos = contactsAdmin({ porMeta: null, porFone: [] });
    const r = await enviarPeloCrm(
      adminSemIdempotencia(contatos) as never,
      "org",
      { ...pedido(), phone: "+5561996715985" },
      "req-1",
      {
        enviarMensagem,
        criarPessoa,
        registrarDisparo,
        avaliarDisparo: async () => ({ ok: true }),
        sessao: { id: "s1", provider: "canal" },
        estadoJanela: () => ({ tipo: "sem_restricao" }),
      },
    );
    expect(criarPessoa).toHaveBeenCalledWith(
      expect.anything(),
      "org",
      expect.objectContaining({ phone: "+5561996715985" }),
    );
    expect(r).toEqual({
      ok: true,
      status: 200,
      message_id: "m-novo",
      conversation_id: "cv-1",
    });
    expect(enviarMensagem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actor: { type: "webhook_source", id: "moope-send" } }),
      expect.objectContaining({ conversation_id: "cv-1", type: "text", body: pedido().body }),
    );
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
      porMeta: { id: "ct-1", phone_number: "+5561999999999", is_blocked: false },
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
      sessao: { id: "s1", provider: "canal" },
      estadoJanela: () => ({ tipo: "sem_restricao" as const }),
    });
    expect(r).toMatchObject({ ok: false, status: 429, retry_after: 5 });
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

});
