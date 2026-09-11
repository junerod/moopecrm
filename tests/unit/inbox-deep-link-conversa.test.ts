import { describe, expect, it } from "vitest";

import { precisaBuscarConversaAvulsa } from "@/lib/inbox/deep-link-conversa";

describe("precisaBuscarConversaAvulsa", () => {
  it("busca quando há id e a conversa não está na lista", () => {
    expect(precisaBuscarConversaAvulsa("abc", null)).toBe(true);
    expect(precisaBuscarConversaAvulsa("abc", undefined)).toBe(true);
  });

  it("não busca de novo se a lista já trouxe a conversa", () => {
    expect(precisaBuscarConversaAvulsa("abc", { id: "abc" })).toBe(false);
  });

  it("não busca sem seleção", () => {
    expect(precisaBuscarConversaAvulsa(null, null)).toBe(false);
    expect(precisaBuscarConversaAvulsa(undefined, null)).toBe(false);
  });
});
