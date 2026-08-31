import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WahaClient } from "@/lib/waha/client";

/**
 * Sem `limit`/`offset`, o WAHA Plus devolve 100 e o botão "Atualizar do
 * aparelho" repetia a primeira página. Este teste é a prova: uma agenda
 * de 250 nomes exige três URLs com offset, e URL sem `limit=` reprova.
 */

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function paginaDe(inicio: number, qtd: number): { id: string }[] {
  return Array.from({ length: qtd }, (_, i) => ({ id: `${inicio + i}@c.us` }));
}

describe("agenda do aparelho não para na primeira página", () => {
  it("pagina /api/contacts/all com limit e offset — 250 nomes exigem 3 páginas", async () => {
    const agenda = new Map<number, { id: string }[]>([
      [0, paginaDe(0, 100)],
      [100, paginaDe(100, 100)],
      [200, paginaDe(200, 50)],
    ]);

    globalThis.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      expect(u, "sem limit= o WAHA devolve 100 e o resto some").toMatch(/[?&]limit=/);
      expect(u).toContain("/api/contacts/all");
      const parsed = new URL(u);
      const offset = Number(parsed.searchParams.get("offset") ?? "0");
      const lote = agenda.get(offset) ?? [];
      return {
        ok: true,
        status: 200,
        json: async () => lote,
        text: async () => "",
      };
    }) as unknown as typeof fetch;

    const lista = await new WahaClient("http://waha", "k").listContacts("s1");
    expect(lista).toHaveLength(250);
    const urls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toMatch(/offset=0/);
    expect(urls[1]).toMatch(/offset=100/);
    expect(urls[2]).toMatch(/offset=200/);
  });

  it("WAHA que ignora offset e devolve a mesma página para — não duplica", async () => {
    const mesma = paginaDe(0, 100);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mesma,
      text: async () => "",
    })) as unknown as typeof fetch;

    const lista = await new WahaClient("http://waha", "k").listContacts("s1");
    expect(lista).toHaveLength(100);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("404 em /contacts/all cai no path legado paginado", async () => {
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/api/contacts/all")) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
      }
      const parsed = new URL(u);
      const offset = Number(parsed.searchParams.get("offset") ?? "0");
      const lote = offset === 0 ? paginaDe(0, 100) : paginaDe(100, 20);
      return { ok: true, status: 200, json: async () => lote, text: async () => "" };
    }) as unknown as typeof fetch;

    const lista = await new WahaClient("http://waha", "k").listContacts("s1");
    expect(lista).toHaveLength(120);
    const urls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/api/s1/contacts"))).toBe(true);
  });
});
