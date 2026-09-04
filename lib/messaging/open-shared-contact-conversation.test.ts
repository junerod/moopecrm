import { describe, expect, it, vi } from "vitest";

import { openSharedContactConversation } from "@/lib/messaging/open-shared-contact-conversation";

function adminInbox(opts: {
  sessao?: boolean;
  fichas?: Array<{
    id: string;
    phone_number: string | null;
    wa_identity?: string | null;
    wa_lid?: string | null;
  }>;
  criadoId?: string;
}) {
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    rpcs,
    from: (tabela: string) => {
      if (tabela === "channel_sessions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: opts.sessao === false ? null : { id: "s1" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (tabela === "conversations") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: { id: "cv-1", status: "open" } }),
        };
        return chain;
      }
      if (tabela === "contacts") {
        const self = {
          select: () => self,
          eq: () => self,
          in: () => self,
          is: () => self,
          then: (resolve: (v: { data: unknown }) => void) =>
            resolve({ data: opts.fichas ?? [] }),
        };
        return self;
      }
      throw new Error(tabela);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return { data: opts.criadoId ?? "ct-novo", error: null };
    },
  };
}

describe("openSharedContactConversation — número novo", () => {
  it("sem ficha cria contato com o 9 e abre a conversa", async () => {
    const admin = adminInbox({ fichas: [], criadoId: "ct-novo" });
    const r = await openSharedContactConversation(admin as never, "org", {
      channel_session_id: "s1",
      phone_number: "+5561996715985",
      name: "Locatário",
    });
    expect(r).toEqual({ conversation_id: "cv-1", contact_id: "ct-novo" });
    expect(admin.rpcs[0]?.fn).toBe("fn_upsert_wa_contact");
    expect(admin.rpcs[0]?.args.p_phone).toBe("+5561996715985");
    expect(admin.rpcs[0]?.args.p_chat_id).toBe("5561996715985");
  });

  it("gêmeo só com phone: sem o 9 não reusa — cria com o número pedido", async () => {
    const admin = adminInbox({
      fichas: [
        {
          id: "ct-sem-9",
          phone_number: "+556196715985",
          wa_identity: "phone:+556196715985",
          wa_lid: null,
        },
      ],
      criadoId: "ct-com-9",
    });
    const r = await openSharedContactConversation(admin as never, "org", {
      channel_session_id: "s1",
      phone_number: "+5561996715985",
    });
    expect(r.contact_id).toBe("ct-com-9");
    expect(admin.rpcs).toHaveLength(1);
    expect(admin.rpcs[0]?.args.p_phone).toBe("+5561996715985");
  });

  it("gêmeo com LID da mesma pessoa reusa a ficha", async () => {
    const admin = adminInbox({
      fichas: [
        {
          id: "ct-wa",
          phone_number: "+556196715985",
          wa_lid: "235587596492898",
        },
      ],
    });
    const rpc = vi.spyOn(admin, "rpc");
    const r = await openSharedContactConversation(admin as never, "org", {
      channel_session_id: "s1",
      phone_number: "+5561996715985",
    });
    expect(r.contact_id).toBe("ct-wa");
    expect(rpc).not.toHaveBeenCalled();
  });
});
