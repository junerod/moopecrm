import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * O CLIQUE NO MENU ESPERAVA UMA FILA DE TELAS QUE NINGUÉM PEDIU.
 *
 * Cada `<Link>` visível pede a página inteira assim que entra na tela. O menu
 * tem dezenas. Todas são dinâmicas, então cada uma renderiza no servidor. O
 * processo é um só: o clique de verdade entra no fim dessa fila, a tela antiga
 * fica no lugar, e parece que travou.
 *
 * `prefetch={false}` faz o clique ser UMA renderização, não trinta.
 */

const BARRA = readFileSync("components/shell/Sidebar.tsx", "utf8");

describe("o menu não pede as outras telas antes do clique", () => {
  it("cada link da barra desliga o prefetch", () => {
    const links = [...BARRA.matchAll(/<Link\b[\s\S]*?>/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThan(0);
    for (const tag of links) {
      expect(tag, tag).toContain("prefetch={false}");
    }
  });
});
