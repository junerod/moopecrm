import { describe, expect, it } from "vitest";

import { assinarLaunch, verificarLaunch } from "@/lib/moope/launch";
import { caminhoDoLaunchEhSeguro, MOOPE_LAUNCH_TTL_SECONDS } from "@/lib/moope/tipos";

const SECRET = "x".repeat(32);

describe("launch MOOPE", () => {
  it("assina e verifica dentro da janela de 90s", () => {
    const agora = 1_700_000_000_000;
    const token = assinarLaunch(
      { email: "socio@escritorio.com", orgId: "org-1", path: "/app/inbox?id=abc" },
      SECRET,
      agora,
    );
    const payload = verificarLaunch(token, SECRET, agora + 10_000);
    expect(payload).toEqual({
      email: "socio@escritorio.com",
      orgId: "org-1",
      path: "/app/inbox?id=abc",
      exp: Math.floor(agora / 1000) + MOOPE_LAUNCH_TTL_SECONDS,
    });
  });

  it("recusa token vencido e assinatura adulterada", () => {
    const agora = 1_700_000_000_000;
    const token = assinarLaunch(
      { email: "a@b.com", orgId: "org-1", path: "/app/inbox" },
      SECRET,
      agora,
    );
    expect(verificarLaunch(token, SECRET, agora + 91_000)).toBeNull();
    expect(verificarLaunch(`${token}x`, SECRET, agora)).toBeNull();
    expect(verificarLaunch(token, "outro".repeat(8), agora)).toBeNull();
  });

  it("path fora do allowlist cai no inbox", () => {
    const agora = 1_700_000_000_000;
    const token = assinarLaunch(
      { email: "a@b.com", orgId: "org-1", path: "/login" },
      SECRET,
      agora,
    );
    expect(verificarLaunch(token, SECRET, agora)?.path).toBe("/app/inbox");
  });

  it("só aceita deep link do app", () => {
    expect(caminhoDoLaunchEhSeguro("/app/contacts/x")).toBe(true);
    expect(caminhoDoLaunchEhSeguro("/app/inbox?id=1")).toBe(true);
    expect(caminhoDoLaunchEhSeguro("/app/pipeline?lead=1")).toBe(true);
    expect(caminhoDoLaunchEhSeguro("/login")).toBe(false);
    expect(caminhoDoLaunchEhSeguro("/app/../admin")).toBe(false);
  });
});
