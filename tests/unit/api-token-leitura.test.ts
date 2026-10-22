import { describe, expect, it } from "vitest";

import {
  ESCOPO_FUNIL_DO_CRM,
  ESCOPO_LEITURA_DO_CRM,
  escritaAutorizada,
  instanteDaValidade,
  leituraAutorizada,
} from "@/lib/api-tokens/contrato";

const AGORA = new Date("2026-10-22T15:00:00.000Z");

describe("token de leitura do CRM", () => {
  it("sem data, o token vale até ser revogado", () => {
    expect(instanteDaValidade(undefined, undefined, AGORA)).toEqual({ ok: true, expiresAt: null });
  });

  it("a data escolhida vale até o fim daquele dia", () => {
    const r = instanteDaValidade("2026-12-31", undefined, AGORA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expiresAt).toBe("2027-01-01T02:59:59.999Z");
  });

  it("recusa data passada e validade além de 5 anos", () => {
    expect(instanteDaValidade("2020-01-01", undefined, AGORA).ok).toBe(false);
    expect(instanteDaValidade("2040-01-01", undefined, AGORA).ok).toBe(false);
  });

  it("token revogado, vencido ou sem a permissão de ler não entra", () => {
    expect(
      leituraAutorizada({
        encontrado: true,
        scopes: [ESCOPO_LEITURA_DO_CRM],
        revokedAt: null,
        expiresAt: null,
        agora: AGORA,
      }).ok,
    ).toBe(true);
    expect(
      leituraAutorizada({
        encontrado: true,
        scopes: [ESCOPO_LEITURA_DO_CRM],
        revokedAt: "2026-10-01T00:00:00.000Z",
        expiresAt: null,
        agora: AGORA,
      }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      leituraAutorizada({
        encontrado: true,
        scopes: [ESCOPO_LEITURA_DO_CRM],
        revokedAt: null,
        expiresAt: "2026-10-01T00:00:00.000Z",
        agora: AGORA,
      }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      leituraAutorizada({
        encontrado: true,
        scopes: ["mcp:write"],
        revokedAt: null,
        expiresAt: null,
        agora: AGORA,
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      leituraAutorizada({
        encontrado: false,
        scopes: [],
        revokedAt: null,
        expiresAt: null,
        agora: AGORA,
      }),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("mexer no funil exige a permissão de escrever, mesmo com a de ler", () => {
    expect(
      escritaAutorizada({
        encontrado: true,
        scopes: [ESCOPO_LEITURA_DO_CRM],
        revokedAt: null,
        expiresAt: null,
        agora: AGORA,
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      escritaAutorizada({
        encontrado: true,
        scopes: [ESCOPO_LEITURA_DO_CRM, ESCOPO_FUNIL_DO_CRM],
        revokedAt: null,
        expiresAt: null,
        agora: AGORA,
      }).ok,
    ).toBe(true);
  });
});
