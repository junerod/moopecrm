import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../pos-entrada", () => ({
  aplicarEfeitosPosEntrada: vi.fn().mockResolvedValue(undefined),
}));

import { ingestDirectInbound } from "./ingest";
import type { DirectInboundEvent } from "./webhook";

const EVENTO: DirectInboundEvent = {
  kind: "inbound_message",
  accountId: "17841400000",
  from: "igsid-ana",
  username: "ana",
  externalId: "mid.1",
  text: "quero o carro",
  sentAt: new Date("2026-09-15T12:00:00.000Z"),
  referral: null,
};

function adminCom(sessao: { id: string; organization_id: string } | null) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  let contatoCriado = false;

  const chain = (table: string) => {
    const api: Record<string, unknown> = {};
    api.select = () => api;
    api.eq = () => api;
    api.is = () => api;
    api.maybeSingle = async () => {
      if (table === "channel_sessions") return { data: sessao, error: null };
      if (table === "contacts") {
        return contatoCriado
          ? { data: { id: "ct-1" }, error: null }
          : { data: null, error: null };
      }
      return { data: { id: "msg-1" }, error: null };
    };
    api.insert = (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      if (table === "contacts") contatoCriado = true;
      return api;
    };
    api.update = () => api;
    return api;
  };

  return {
    inserts,
    admin: {
      from: (table: string) => chain(table),
      rpc: async (name: string) => {
        if (name === "fn_upsert_wa_conversation") {
          return { data: "conv-1", error: null };
        }
        return { data: null, error: null };
      },
    } as never,
  };
}

describe("ingestDirectInbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem sessão da conta — não inventa conversa", async () => {
    const { admin } = adminCom(null);
    const r = await ingestDirectInbound(admin, EVENTO, {
      organizationId: "org-1",
    });
    expect(r).toEqual({ status: "no_session" });
  });

  it("grava o contato pelo IGSID, sem telefone", async () => {
    const { admin, inserts } = adminCom({
      id: "sess-1",
      organization_id: "org-1",
    });
    const r = await ingestDirectInbound(admin, EVENTO, { organizationId: "org-1" });
    expect(r).toEqual({
      status: "ingested",
      messageId: "msg-1",
      conversationId: "conv-1",
    });
    const contato = inserts.find((i) => i.table === "contacts")?.row;
    expect(contato).toEqual(
      expect.objectContaining({
        organization_id: "org-1",
        phone_number: null,
        wa_identity: "igsid:igsid-ana",
        source: "instagram",
      }),
    );
  });
});
