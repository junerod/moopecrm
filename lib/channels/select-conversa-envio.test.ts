import { describe, expect, it } from "vitest";

import {
  carregarConversaDoEnvio,
  isMissingDbColumn,
  montarSelectConversaEnvio,
} from "./select-conversa-envio";

describe("montarSelectConversaEnvio", () => {
  it("no banco completo pede archived_at e a coluna nova do sessionRef", () => {
    const select = montarSelectConversaEnvio(new Set());
    expect(select).toContain("archived_at");
    expect(select).toContain("twilio_from");
    expect(select).toContain("wa_lid");
  });

  it("omite só a coluna que o 42703 nomeou", () => {
    const select = montarSelectConversaEnvio(new Set(["twilio_from"]));
    expect(select).not.toContain("twilio_from");
    expect(select).toContain("archived_at");
    expect(select).toContain("waha_session_name");
  });
});

describe("carregarConversaDoEnvio", () => {
  it("42703 em twilio_from ainda devolve a conversa — o INSERT não morre antes", async () => {
    const selects: string[] = [];
    const supabase = {
      from() {
        return {
          select(cols: string) {
            selects.push(cols);
            return {
              eq() {
                return {
                  async maybeSingle() {
                    if (cols.includes("twilio_from")) {
                      return {
                        data: null,
                        error: {
                          code: "42703",
                          message: "column channel_sessions_1.twilio_from does not exist",
                        },
                      };
                    }
                    return { data: { id: "conv-1" }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    const { data, error } = await carregarConversaDoEnvio(
      supabase as never,
      "conv-1",
    );

    expect(error).toBeNull();
    expect(data).toEqual({ id: "conv-1" });
    expect(selects[0]).toContain("twilio_from");
    expect(selects[1]).not.toContain("twilio_from");
  });

  it("erro que não é coluna ausente sobe — não engole falha de verdade", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: null,
                      error: { code: "42501", message: "permission denied" },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const { error } = await carregarConversaDoEnvio(supabase as never, "conv-1");
    expect(error?.code).toBe("42501");
  });
});

describe("isMissingDbColumn", () => {
  it("só casa SQLSTATE de coluna ausente + o nome na mensagem", () => {
    expect(
      isMissingDbColumn(
        { code: "42703", message: "column channel_sessions_1.twilio_from does not exist" },
        "twilio_from",
      ),
    ).toBe(true);
    expect(
      isMissingDbColumn(
        { code: "42703", message: "column channel_sessions_1.twilio_from does not exist" },
        "archived_at",
      ),
    ).toBe(false);
    expect(isMissingDbColumn({ code: "42501", message: "twilio_from" }, "twilio_from")).toBe(
      false,
    );
  });
});
