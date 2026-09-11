import { describe, expect, it } from "vitest";

import { ABA_PADRAO_DA_INBOX, parseAbaDaInbox } from "@/lib/inbox/aba-padrao";

const VALIDAS = ["unassigned", "mine", "all", "closed", "ai"] as const;

describe("aba padrão da Inbox", () => {
  it("sem query abre Minhas — não a Fila técnica", () => {
    expect(ABA_PADRAO_DA_INBOX).toBe("mine");
    expect(parseAbaDaInbox(null, VALIDAS)).toBe("mine");
    expect(parseAbaDaInbox("", VALIDAS)).toBe("mine");
  });

  it("honra ?filter= explícito, inclusive a Fila", () => {
    expect(parseAbaDaInbox("unassigned", VALIDAS)).toBe("unassigned");
    expect(parseAbaDaInbox("all", VALIDAS)).toBe("all");
    expect(parseAbaDaInbox("closed", VALIDAS)).toBe("closed");
  });
});
