import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  contatoPodeImportarConversa,
  rotuloImportarConversa,
} from "@/lib/channels/historico-tipos";
import {
  historicoAindaFresco,
  puxarHistoricoAposReligamento,
  sincronizarContatosDosCanaisNoAr,
} from "@/lib/channels/historico";
import { WahaLojaIndisponivel } from "@/lib/waha/client";
import {
  chatFicaDeFora,
  chatIdDoContato,
  contatoDaAgendaMereceLista,
  corpoDaMensagemDaLoja,
  corteDosFiosNovos,
  fioPrecisaEntrarNoInbox,
  FOLGA_FIO_JA_NO_INBOX_MS,
  historicoTravado,
  idDoChat,
  importarConversaDoContato,
  instanteDoChat,
  JANELA_INBOX_VAZIA_MS,
  mensagemDaLojaParaPayload,
  nomeDoChat,
  puxarHistorico,
  puxarHistoricoAoConectar,
  SOBREPOSICAO_FIOS_MS,
} from "@/lib/waha/historico";
import {
  carimbarConversaDoHistorico,
  ingerirMensagemHistorica,
  upsertContatoDoHistorico,
} from "@/lib/waha/ingest";

vi.mock("@/lib/waha/ingest", () => ({
  upsertContatoDoHistorico: vi.fn(async (_a: unknown, _o: unknown, chatId: string) =>
    chatId.endsWith("@c.us") || chatId.endsWith("@lid") || chatId.endsWith("@s.whatsapp.net")
      ? "contact-1"
      : null,
  ),
  ingerirMensagemHistorica: vi.fn(async (_a: unknown, _s: unknown, p: { id?: string }) =>
    p.id
      ? {
          kind: "gravou",
          conversationId: "conv-1",
          direction: "inbound",
          preview: "oi",
          sentAt: "2026-01-01T00:00:00.000Z",
        }
      : { kind: "pulou" },
  ),
  carimbarConversaDoHistorico: vi.fn(async () => undefined),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

describe("o que a loja manda vira o contrato da ingestão", () => {
  it("grupo, estado e canal ficam de fora", () => {
    expect(chatFicaDeFora("120363@g.us")).toBe(true);
    expect(chatFicaDeFora("status@broadcast")).toBe(true);
    expect(chatFicaDeFora("123@newsletter")).toBe(true);
    expect(chatFicaDeFora("5561999999999@c.us")).toBe(false);
  });

  it("lê id tanto cru quanto _serialized", () => {
    expect(idDoChat({ id: "5561@c.us" })).toBe("5561@c.us");
    expect(idDoChat({ id: { _serialized: "5561@c.us" } })).toBe("5561@c.us");
    expect(idDoChat({})).toBeNull();
  });

  it("agenda sem sufixo vira chat endereçável", () => {
    expect(idDoChat({ number: "5561999999999", name: "Salvo" })).toBe(
      "5561999999999@c.us",
    );
    expect(idDoChat({ id: "5561888888888" })).toBe("5561888888888@c.us");
  });

  it("número da agenda vence o id opaco", () => {
    expect(idDoChat({ id: "701928@lid", number: "556196715985", name: "June" })).toBe(
      "556196715985@c.us",
    );
  });

  it("id opaco sem nome não entra na lista", () => {
    expect(contatoDaAgendaMereceLista("701928@lid", null)).toBe(false);
    expect(contatoDaAgendaMereceLista("5561@c.us", null)).toBe(true);
    expect(contatoDaAgendaMereceLista("701928@lid", "Maria")).toBe(true);
  });

  it("WAHA manda pushname minúsculo — sem isto a agenda @lid some", () => {
    const cru = { id: "70192801575156@lid", pushname: "June da agenda" };
    expect(nomeDoChat(cru)).toBe("June da agenda");
    expect(contatoDaAgendaMereceLista(idDoChat(cru) ?? "", nomeDoChat(cru))).toBe(true);
  });

  it("texto da loja vem de conversation quando body falta", () => {
    expect(
      corpoDaMensagemDaLoja({
        id: "false_5561@c.us_AAA",
        _data: { message: { conversation: "bom dia doutor" } },
      }),
    ).toBe("bom dia doutor");
    const p = mensagemDaLojaParaPayload("5561@c.us", {
      id: "false_5561@c.us_AAA",
      fromMe: false,
      _data: { message: { conversation: "bom dia doutor" } },
    });
    expect(p?.body).toBe("bom dia doutor");
  });

  it("protocolo sem corpo some — igual à ingestão ao vivo", () => {
    expect(
      mensagemDaLojaParaPayload("5561@c.us", {
        id: "false_5561@c.us_AAA",
        fromMe: false,
        type: "protocol",
      }),
    ).toBeNull();
  });

  it("fromMe usa o chat como destinatário", () => {
    const p = mensagemDaLojaParaPayload("5561@c.us", {
      id: "true_5561@c.us_BBB",
      fromMe: true,
      body: "já te liguei",
      timestamp: 1_700_000_000,
    });
    expect(p?.fromMe).toBe(true);
    expect(p?.to).toBe("5561@c.us");
    expect(p?.body).toBe("já te liguei");
  });

  it("entrada usa o chat como remetente quando from falta", () => {
    const p = mensagemDaLojaParaPayload("5561@c.us", {
      id: "false_5561@c.us_CCC",
      fromMe: false,
      body: "doutor?",
    });
    expect(p?.from).toBe("5561@c.us");
    expect(p?.fromMe).toBe(false);
  });
});

describe("o gatilho recusa emitir evento de legado", () => {
  it("a guarda está na migration E no apêndice — clone sem um dos dois ainda responde cliente velho", () => {
    const migracao = readFileSync(
      join(process.cwd(), "supabase/migrations/20260830120000_0196_historico_nao_emite_evento.sql"),
      "utf8",
    );
    const baseline = readFileSync(join(process.cwd(), "supabase/baseline.sql"), "utf8");
    const guarda = "metadata->>'historico'";
    expect(migracao.includes(guarda), "a 0196 perdeu a guarda").toBe(true);
    expect(baseline.includes(guarda), "o baseline do self-host perdeu a guarda").toBe(true);
    // A última definição do baseline é a que vale no update.sh.
    const ultimo = baseline.lastIndexOf("create or replace function public.fn_emit_message_event");
    const pedaco = baseline.slice(ultimo);
    expect(pedaco.includes(guarda), "uma definição mais nova voltou a emitir tudo").toBe(true);
  });

  it("o clique pede a agenda completa — o cron não", () => {
    const src = readFileSync(join(process.cwd(), "lib/channels/historico.ts"), "utf8");
    expect(src).toMatch(/pedirAgendaCompleta:\s*true/);
    expect(src).toMatch(/auditar:\s*false/);
  });

  it("abrir o inbox dispara o mesmo sync — senão a fila espera o cron", () => {
    const tela = readFileSync(join(process.cwd(), "components/inbox/InboxLayout.tsx"), "utf8");
    expect(tela).toMatch(/useSincronizarContatosDoAparelho/);
  });

  it("o efeito do sync não depende da identidade da lista — senão o inbox entra em loop", () => {
    const src = readFileSync(
      join(process.cwd(), "hooks/channels/useSincronizarContatosDoAparelho.ts"),
      "utf8",
    );
    expect(src).toMatch(/sessionsRef/);
    expect(src).toMatch(/assinatura/);
    expect(src).not.toMatch(/void puxar\(false\);\s*\}, \[puxar\]/);
    expect(src).not.toMatch(/\[enabled, sessions, qc\]/);
  });
});

function adminComMetadata(
  metadata: unknown,
  inbox: {
    last_message_at?: string | null;
    fios?: { contact_id: string; last_message_at: string }[];
  } = {},
) {
  const cadeiaInbox = () => {
    const fios = inbox.fios ?? [];
    const ultima = inbox.last_message_at
      ? { last_message_at: inbox.last_message_at }
      : null;
    const chain: {
      select: () => typeof chain;
      eq: () => typeof chain;
      not: () => typeof chain;
      order: () => typeof chain;
      limit: () => typeof chain;
      in: () => Promise<{ data: typeof fios; error: null }>;
      maybeSingle: () => Promise<{ data: typeof ultima; error: null }>;
    } = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      in: async () => ({ data: fios, error: null }),
      maybeSingle: async () => ({ data: ultima, error: null }),
    };
    return chain;
  };
  return {
    rpc: async () => ({ data: null, error: null }),
    from: (tabela?: string) => {
      if (tabela === "conversations") return cadeiaInbox();
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { metadata }, error: null }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      };
    },
  };
}

describe("puxar o legado", () => {
  const sessao = {
    id: "s1",
    organization_id: "o1",
    waha_session_name: "org_x",
  };

  it("pula grupo e grava SÓ o contato — inbox fica limpo", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    vi.mocked(ingerirMensagemHistorica).mockClear();
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => [
        { id: "120363@g.us", conversationTimestamp: 9 },
        { id: "5561@c.us", name: "Maria", conversationTimestamp: 8 },
      ]),
      listChatMessages: vi.fn(async () => [{ id: "m1", fromMe: false, body: "oi" }]),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(r.status).toBe("pronto");
    expect(r.contatos).toBe(1);
    expect(r.conversas).toBe(0);
    expect(r.mensagens).toBe(0);
    expect(cliente.listChatMessages, "chat de 1970 não entra no recorte").not.toHaveBeenCalled();
    expect(ingerirMensagemHistorica).not.toHaveBeenCalled();
    expect(upsertContatoDoHistorico).toHaveBeenCalledOnce();
  });

  it("recorte recente entra no inbox sozinho — sem caçar o contato", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    vi.mocked(ingerirMensagemHistorica).mockClear();
    const tsRecente = Math.floor(Date.parse("2026-08-30T11:00:00.000Z") / 1000);
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => [
        { id: "5561888@c.us", name: "Suporte agora", conversationTimestamp: tsRecente },
        { id: "5561@c.us", name: "Maria", conversationTimestamp: 8 },
      ]),
      listChatMessages: vi.fn(async (_s: string, chatId: string) =>
        chatId === "5561888@c.us"
          ? [{ id: "m-nova", fromMe: false, body: "preciso de suporte", timestamp: tsRecente }]
          : [],
      ),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T12:00:00.000Z",
    });
    expect(r.status).toBe("pronto");
    expect(r.contatos).toBe(2);
    expect(r.conversas, "sem isto o inbox continua cego depois do reconnect").toBe(1);
    expect(r.mensagens).toBe(1);
    expect(cliente.listChatMessages).toHaveBeenCalled();
    expect(cliente.listChatMessages.mock.calls.every((c) => c[1] !== "5561@c.us")).toBe(true);
    expect(ingerirMensagemHistorica).toHaveBeenCalled();
  });

  it("fio que já está no inbox e no mesmo instante não baixa de novo", async () => {
    vi.mocked(ingerirMensagemHistorica).mockClear();
    const tsRecente = Math.floor(Date.parse("2026-08-30T11:00:00.000Z") / 1000);
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => [
        { id: "5561888@c.us", name: "Já no inbox", conversationTimestamp: tsRecente },
      ]),
      listChatMessages: vi.fn(async () => [{ id: "m1", fromMe: false, body: "oi" }]),
    };
    const r = await puxarHistorico(
      adminComMetadata(
        {},
        {
          last_message_at: "2026-08-30T11:00:00.000Z",
          fios: [{ contact_id: "contact-1", last_message_at: "2026-08-30T11:00:00.000Z" }],
        },
      ) as never,
      sessao,
      {
        cliente,
        dormir: async () => undefined,
        agora: () => "2026-08-30T12:00:00.000Z",
      },
    );
    expect(r.conversas).toBe(0);
    expect(cliente.listChatMessages, "não reedita fio em dia").not.toHaveBeenCalled();
    expect(ingerirMensagemHistorica).not.toHaveBeenCalled();
  });

  it("importar no contato é o que abre o fio", async () => {
    vi.mocked(ingerirMensagemHistorica).mockClear();
    vi.mocked(carimbarConversaDoHistorico).mockClear();
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => []),
      listChatMessages: vi.fn(async () => [
        { id: "m1", fromMe: false, body: "oi", timestamp: 1 },
        { id: "m2", fromMe: true, body: "olá", timestamp: 2 },
      ]),
    };
    const r = await importarConversaDoContato(
      adminComMetadata({}) as never,
      sessao,
      {
        id: "c1",
        organization_id: "o1",
        phone_number: "+5561999999999",
        source_metadata: { waha_chat_id: "5561@c.us" },
      },
      { cliente },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mensagens).toBe(2);
      expect(r.conversationId).toBe("conv-1");
    }
    expect(carimbarConversaDoHistorico).toHaveBeenCalledOnce();
  });

  it("quem já tem fio atualiza; quem não tem, importa", () => {
    expect(rotuloImportarConversa(false, true)).toBe("Importar");
    expect(rotuloImportarConversa(true, true)).toBe("Atualizar");
    expect(rotuloImportarConversa(true, false)).toBe("Atualizar conversa");
  });

  it("contato sem WhatsApp não inventa conversa", () => {
    expect(chatIdDoContato({ phone_number: null, source_metadata: {} })).toBeNull();
    expect(
      contatoPodeImportarConversa({ phone_number: null, source_metadata: {} }),
    ).toBe(false);
    expect(
      contatoPodeImportarConversa({
        phone_number: "+5561999999999",
        source_metadata: {},
      }),
    ).toBe(true);
    expect(
      contatoPodeImportarConversa({
        phone_number: null,
        source_metadata: { waha_chat_id: "701@lid" },
      }),
    ).toBe(false);
  });

  it("loja desligada vira erro que pede QR — não 'WhatsApp caiu'", async () => {
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => {
        throw new WahaLojaIndisponivel("store disabled");
      }),
      listChatMessages: vi.fn(async () => []),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(r.status).toBe("erro");
    expect(r.motivo ?? "").toMatch(/escaneie o QR/i);
    expect(r.motivo ?? "").not.toMatch(/WAHA/i);
  });

  it("número salvo na agenda entra mesmo sem conversa recente", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => [{ id: "5561@c.us", name: "Maria", conversationTimestamp: 8 }]),
      listContacts: vi.fn(async () => [
        { number: "5561888888888", name: "Salvo sem conversa" },
        { id: "5561@c.us", name: "Maria de novo" },
        { id: "701928@lid" },
        { id: "me", isMe: true, number: "5561000000000" },
      ]),
      listChatMessages: vi.fn(async () => []),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(r.status).toBe("pronto");
    expect(r.contatos).toBe(2);
    expect(upsertContatoDoHistorico).toHaveBeenCalledTimes(2);
    const ids = vi.mocked(upsertContatoDoHistorico).mock.calls.map((c) => c[2]);
    expect(ids).toEqual(expect.arrayContaining(["5561@c.us", "5561888888888@c.us"]));
    expect(cliente.listChatMessages).not.toHaveBeenCalled();
  });

  it("agenda @lid com pushname entra — o formato que o WAHA realmente manda", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async () => []),
      listContacts: vi.fn(async () => [
        { id: "70192801575156@lid", pushname: "June da agenda" },
        { id: "70192801575157@lid" },
      ]),
      listChatMessages: vi.fn(async () => []),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(r.status).toBe("pronto");
    expect(r.contatos).toBe(1);
    expect(upsertContatoDoHistorico).toHaveBeenCalledWith(
      expect.anything(),
      "o1",
      "70192801575156@lid",
      "June da agenda",
      null,
    );
  });

  it("loja curta no clique reinicia a sessão — o cron não", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    const reiniciarSessao = vi.fn(async () => undefined);
    let vez = 0;
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      reiniciarSessao,
      listChats: vi.fn(async () => []),
      listContacts: vi.fn(async () => {
        vez += 1;
        if (vez === 1) return [{ id: "1@lid", pushname: "A" }];
        return Array.from({ length: 90 }, (_, i) => ({
          id: `${i}@lid`,
          pushname: `N${i}`,
        }));
      }),
      listChatMessages: vi.fn(async () => []),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      pedirAgendaCompleta: true,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(reiniciarSessao).toHaveBeenCalledOnce();
    expect(r.contatos).toBe(90);
    expect(r.loja_curta).toBeUndefined();

    reiniciarSessao.mockClear();
    vez = 0;
    await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(reiniciarSessao, "cron não cai o canal").not.toHaveBeenCalled();
  });

  it("já pediu a agenda há pouco — não cai o canal de novo", async () => {
    const reiniciarSessao = vi.fn(async () => undefined);
    const r = await puxarHistorico(
      adminComMetadata({
        reinicio_agenda_em: "2026-08-30T00:00:00.000Z",
      }) as never,
      sessao,
      {
        cliente: {
          convergirConfigDaSessao: vi.fn(async () => undefined),
          reiniciarSessao,
          listChats: vi.fn(async () => []),
          listContacts: vi.fn(async () => [{ id: "1@lid", pushname: "A" }]),
          listChatMessages: vi.fn(async () => []),
        },
        pedirAgendaCompleta: true,
        dormir: async () => undefined,
        agora: () => "2026-08-30T00:05:00.000Z",
      },
    );
    expect(reiniciarSessao).not.toHaveBeenCalled();
    expect(r.loja_curta).toBe(true);
  });

  it("contato só da agenda não some quando já há 2000 chats", async () => {
    vi.mocked(upsertContatoDoHistorico).mockClear();
    const chats = Array.from({ length: 2000 }, (_, i) => ({
      id: `${1000 + i}@c.us`,
      conversationTimestamp: 10_000 + i,
    }));
    const cliente = {
      convergirConfigDaSessao: vi.fn(async () => undefined),
      listChats: vi.fn(async (_s: string, limit = 200, offset = 0) =>
        chats.slice(offset, offset + limit),
      ),
      listContacts: vi.fn(async () => [
        { number: "5561999999999", name: "Salvo antigo" },
      ]),
      listChatMessages: vi.fn(async () => []),
    };
    const r = await puxarHistorico(adminComMetadata({}) as never, sessao, {
      cliente,
      dormir: async () => undefined,
      agora: () => "2026-08-30T00:00:00.000Z",
    });
    expect(r.status).toBe("pronto");
    const ids = vi.mocked(upsertContatoDoHistorico).mock.calls.map((c) => c[2]);
    expect(ids, "teto de chats cortava quem só estava na agenda").toContain(
      "5561999999999@c.us",
    );
    expect(r.contatos).toBe(2001);
  });

  it("já importou uma vez — reconexão puxa de novo", async () => {
    const listChats = vi.fn(async () => [{ id: "5561@c.us", conversationTimestamp: 1 }]);
    const r = await puxarHistoricoAoConectar(
      adminComMetadata({
        historico: {
          status: "pronto",
          iniciado_em: "2026-08-01T00:00:00.000Z",
          conversas: 3,
          mensagens: 10,
          puladas: 0,
        },
      }) as never,
      sessao,
      {
        cliente: {
          convergirConfigDaSessao: vi.fn(async () => undefined),
          listChats,
          listChatMessages: vi.fn(async () => []),
          listContacts: vi.fn(async () => []),
        },
        dormir: async () => undefined,
        agora: () => "2026-08-30T00:00:00.000Z",
      },
    );
    expect(r).not.toBeNull();
    expect(r?.status).toBe("pronto");
    expect(listChats).toHaveBeenCalled();
  });

  it("já está rodando agora — não dispara outro", async () => {
    const listChats = vi.fn(async () => []);
    const r = await puxarHistoricoAoConectar(
      adminComMetadata({
        historico: {
          status: "rodando",
          iniciado_em: new Date().toISOString(),
          conversas: 0,
          mensagens: 0,
          puladas: 0,
        },
      }) as never,
      sessao,
      {
        cliente: {
          convergirConfigDaSessao: vi.fn(),
          listChats,
          listChatMessages: vi.fn(),
        },
      },
    );
    expect(r).toBeNull();
    expect(listChats).not.toHaveBeenCalled();
  });

  it("primeira tentativa falhou — reconexão tenta de novo", async () => {
    const listChats = vi.fn(async () => [{ id: "5561@c.us", conversationTimestamp: 1 }]);
    const r = await puxarHistoricoAoConectar(
      adminComMetadata({
        historico: {
          status: "erro",
          iniciado_em: "2026-08-01T00:00:00.000Z",
          motivo: "loja vazia",
          conversas: 0,
          mensagens: 0,
          puladas: 0,
        },
      }) as never,
      sessao,
      {
        cliente: {
          convergirConfigDaSessao: vi.fn(async () => undefined),
          listChats,
          listChatMessages: vi.fn(async () => []),
        },
        dormir: async () => undefined,
        agora: () => "2026-08-30T00:00:00.000Z",
      },
    );
    expect(r?.status).toBe("pronto");
    expect(listChats).toHaveBeenCalled();
  });

  it("rodando há mais de 15 min está travado — o botão volta", () => {
    expect(
      historicoTravado(
        {
          status: "rodando",
          iniciado_em: "2026-08-01T00:00:00.000Z",
          conversas: 0,
          mensagens: 0,
          puladas: 0,
        },
        Date.parse("2026-08-01T00:20:00.000Z"),
      ),
    ).toBe(true);
  });
});

function adminDoLote(linhas: unknown[], pessoas = 10) {
  return {
    from: (tabela: string) => {
      if (tabela === "contacts") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: pessoas, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              limit: async () => ({ data: linhas, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

describe("recorte do inbox — a régua, sem o transporte", () => {
  it("WAHA em segundos vira instante; ms passa direto", () => {
    expect(instanteDoChat(1_700_000_000)).toBe(1_700_000_000_000);
    expect(instanteDoChat(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(instanteDoChat(0)).toBe(0);
  });

  it("inbox vazio ou recente olha 48h; inbox parado olha desde a última", () => {
    const agora = Date.parse("2026-08-30T12:00:00.000Z");
    const vazio = corteDosFiosNovos(agora, null);
    expect(agora - vazio).toBe(JANELA_INBOX_VAZIA_MS + SOBREPOSICAO_FIOS_MS);

    const haUmaHora = agora - 60 * 60 * 1000;
    expect(corteDosFiosNovos(agora, haUmaHora)).toBe(vazio);

    const haUmaSemana = agora - 7 * 24 * 60 * 60 * 1000;
    expect(corteDosFiosNovos(agora, haUmaSemana)).toBe(haUmaSemana - SOBREPOSICAO_FIOS_MS);
  });

  it("órfão entra; fio em dia não; aparelho na frente entra", () => {
    const agora = Date.parse("2026-08-30T12:00:00.000Z");
    expect(fioPrecisaEntrarNoInbox(agora, null)).toBe(true);
    expect(fioPrecisaEntrarNoInbox(agora, agora)).toBe(false);
    expect(fioPrecisaEntrarNoInbox(agora, agora - FOLGA_FIO_JA_NO_INBOX_MS - 1)).toBe(true);
    expect(fioPrecisaEntrarNoInbox(0, null)).toBe(false);
  });
});

describe("lista acompanha o aparelho sem reconectar", () => {
  it("sync fresco não puxa de novo", () => {
    const pronto = {
      status: "pronto" as const,
      iniciado_em: "2026-08-30T00:00:00.000Z",
      terminado_em: "2026-08-30T00:01:00.000Z",
      conversas: 0,
      mensagens: 0,
      puladas: 0,
    };
    expect(historicoAindaFresco(pronto, Date.parse("2026-08-30T00:03:00.000Z"))).toBe(true);
    expect(historicoAindaFresco(pronto, Date.parse("2026-08-30T00:10:00.000Z"))).toBe(false);
  });

  it("canal WORKING com lista velha puxa de novo", async () => {
    const puxar = vi.fn(async () => ({
      status: "pronto" as const,
      iniciado_em: "2026-08-30T00:00:00.000Z",
      conversas: 0,
      mensagens: 0,
      puladas: 0,
      contatos: 2,
    }));
    const r = await sincronizarContatosDosCanaisNoAr({
      agoraMs: Date.parse("2026-08-30T01:00:00.000Z"),
      admin: adminDoLote([
        {
          id: "s1",
          organization_id: "o1",
          status: "WORKING",
          waha_session_name: "org_x",
          archived_at: null,
          metadata: {
            historico: {
              status: "pronto",
              iniciado_em: "2026-08-30T00:00:00.000Z",
              terminado_em: "2026-08-30T00:00:10.000Z",
              conversas: 0,
              mensagens: 0,
              puladas: 0,
            },
          },
        },
      ]) as never,
      puxar,
    });
    expect(r.sessoes).toBe(1);
    expect(r.puxadas).toBe(1);
    expect(puxar).toHaveBeenCalled();
  });

  it("lista fresca é pulada", async () => {
    const puxar = vi.fn();
    const r = await sincronizarContatosDosCanaisNoAr({
      agoraMs: Date.parse("2026-08-30T00:02:00.000Z"),
      admin: adminDoLote([
        {
          id: "s1",
          organization_id: "o1",
          status: "WORKING",
          waha_session_name: "org_x",
          archived_at: null,
          metadata: {
            historico: {
              status: "pronto",
              iniciado_em: "2026-08-30T00:00:00.000Z",
              terminado_em: "2026-08-30T00:01:00.000Z",
              conversas: 0,
              mensagens: 0,
              puladas: 0,
            },
          },
        },
      ]) as never,
      puxar,
    });
    expect(r.puladas).toBe(1);
    expect(puxar).not.toHaveBeenCalled();
  });

  it("reconectar espera o número voltar e então puxa", async () => {
    const iniciar = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        codigo: "nao_conectado",
        mensagem: "ainda não",
      })
      .mockResolvedValueOnce({
        ok: true,
        progresso: {
          status: "pronto",
          iniciado_em: "",
          conversas: 0,
          mensagens: 0,
          puladas: 0,
        },
      });
    const r = await puxarHistoricoAposReligamento("o1", "s1", {
      dormir: async () => undefined,
      tentativas: 3,
      iniciar,
    });
    expect(r.ok).toBe(true);
    expect(iniciar).toHaveBeenCalledTimes(2);
  });
});
