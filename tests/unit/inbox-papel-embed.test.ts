import { describe, expect, it } from "vitest";

import { aplicarPapelNoEmbed } from "@/hooks/contacts/useUpdateContact";

describe("aplicarPapelNoEmbed", () => {
  it("grava o papel no embed objeto da conversa aberta", () => {
    const old = { id: "cv-1", contacts: { id: "c-1", papel: "equipe" } };
    expect(aplicarPapelNoEmbed(old, "c-1", "lead")).toEqual({
      id: "cv-1",
      contacts: { id: "c-1", papel: "lead" },
    });
  });

  it("não toca conversa de outro contato", () => {
    const old = { id: "cv-1", contacts: { id: "c-2", papel: "equipe" } };
    expect(aplicarPapelNoEmbed(old, "c-1", "lead")).toBe(old);
  });
});
