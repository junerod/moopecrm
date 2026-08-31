import { describe, expect, it, vi } from "vitest";

import {
  completarIdentidadeLid,
  lidDoContato,
} from "@/lib/contacts/completar-identidade-lid";
import { rotuloDoContato, telefoneApresentavel } from "@/lib/contacts/rotulo-do-contato";

describe("lidDoContato", () => {
  it("lê a coluna gerada e o metadata do WhatsApp", () => {
    expect(lidDoContato({ wa_lid: "70192801575156@lid" })).toBe("70192801575156");
    expect(lidDoContato({ source_metadata: { waha_chat_id: "7019@lid" } })).toBe("7019");
    expect(lidDoContato({ source_metadata: { waha_lid: "12345" } })).toBe("12345");
    expect(lidDoContato({ source_metadata: { waha_chat_id: "5511999999999@c.us" } })).toBe(null);
  });
});

describe("completarIdentidadeLid", () => {
  it("preenche o telefone na resposta quando o canal já traduziu o lid", async () => {
    const supabase = {
      from: vi.fn((tabela: string) => {
        if (tabela === "conversations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { channel_session_id: "sess-1" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { waha_session_name: "default" },
                }),
              }),
            }),
          }),
        };
      }),
    };

    const saida = await completarIdentidadeLid(
      supabase as never,
      "org-1",
      {
        id: "c1",
        display_name: null,
        name: null,
        phone_number: null,
        source_metadata: { waha_chat_id: "7019@lid" },
      },
      async () => "+5511999999999",
    );

    expect(telefoneApresentavel(saida)).toBe("+5511999999999");
    expect(rotuloDoContato(saida)).toBe("+5511999999999");
  });

  it("não chama o canal quando já há nome e telefone", async () => {
    const from = vi.fn();
    const resolver = vi.fn();
    const saida = await completarIdentidadeLid(
      { from } as never,
      "org-1",
      { id: "c1", display_name: "Ana", phone_number: "+5511" },
      resolver,
    );
    expect(from).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(saida.display_name).toBe("Ana");
  });
});
