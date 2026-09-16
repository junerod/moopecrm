import { describe, expect, it } from "vitest";

import {
  CAMINHO_PADRAO_DO_LAUNCH,
  destinoDoLaunch,
  htmlParaContinuarLaunch,
} from "@/lib/moope/continuar-launch";

describe("continuar launch (quebra a cadeia cross-site)", () => {
  it("path seguro permanece; path de login cai no inbox", () => {
    expect(destinoDoLaunch("/app/inbox")).toBe("/app/inbox");
    expect(destinoDoLaunch("/app/contacts/9")).toBe("/app/contacts/9");
    expect(destinoDoLaunch("/login")).toBe(CAMINHO_PADRAO_DO_LAUNCH);
    expect(destinoDoLaunch("/app/../admin")).toBe(CAMINHO_PADRAO_DO_LAUNCH);
  });

  it("HTML navega no mesmo origin e não é um 302", () => {
    const html = htmlParaContinuarLaunch("/app/inbox?id=abc");
    expect(html).toContain("location.replace(\"/app/inbox?id=abc\")");
    expect(html).toContain('content="0;url=/app/inbox?id=abc"');
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("path inseguro não vaza no HTML", () => {
    const html = htmlParaContinuarLaunch("</script><script>alert(1)</script>");
    expect(html).not.toContain("alert(1)");
    expect(html).toContain(`location.replace("${CAMINHO_PADRAO_DO_LAUNCH}")`);
  });
});
