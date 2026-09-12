import { describe, expect, it } from "vitest";

import { campanhaDeOrigemDoContato, marcarRespostaDaCampanha } from "@/lib/campanhas/atribuicao";
import { destinatarioJaEnviado } from "@/lib/campanhas/transicoes";

describe("atribuição de resposta", () => {
  it("só destinatário já enviado pode virar replied", () => {
    expect(destinatarioJaEnviado("sent")).toBe(true);
    expect(destinatarioJaEnviado("pending")).toBe(false);
    expect(destinatarioJaEnviado("skipped")).toBe(false);
  });

  it("origem e resposta falham fechado sem .not() no adaptador incompleto", async () => {
    const db = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          update() {
            return this;
          },
          then(resolve: (v: { data: unknown }) => unknown) {
            return Promise.resolve(resolve({ data: [] }));
          },
        };
      },
    };
    await expect(
      campanhaDeOrigemDoContato(db as never, { organizationId: "o", contactId: "c" }),
    ).resolves.toBeNull();
    await expect(
      marcarRespostaDaCampanha(db as never, { organizationId: "o", contactId: "c" }),
    ).resolves.toBeNull();
  });
});
