import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  consultarInEmLotes,
  partirIdsEmLotes,
  tamanhoDaClausulaIn,
  TETO_IDS_POR_LOTE,
  TETO_URI_GET,
} from "@/lib/supabase/consultar-em-lotes";

function uuid(i: number): string {
  const hex = i.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

describe("consultar em lotes — URI do board", () => {
  it("parte 250 UUIDs em lotes curtos o bastante para o GET", () => {
    const ids = Array.from({ length: 250 }, (_, i) => uuid(i));
    const lotes = partirIdsEmLotes(ids);
    expect(lotes.length).toBe(Math.ceil(250 / TETO_IDS_POR_LOTE));
    for (const lote of lotes) {
      expect(lote.length).toBeLessThanOrEqual(TETO_IDS_POR_LOTE);
      expect(tamanhoDaClausulaIn(lote)).toBeLessThan(TETO_URI_GET);
    }
    expect(tamanhoDaClausulaIn(ids)).toBeGreaterThan(TETO_URI_GET);
  });

  it("consulta cada lote e junta o resultado", async () => {
    const ids = Array.from({ length: 85 }, (_, i) => uuid(i));
    const visto: number[] = [];
    const { data, error } = await consultarInEmLotes<{ id: string }>(ids, async (lote) => {
      visto.push(lote.length);
      return { data: lote.map((id) => ({ id })), error: null };
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(85);
    expect(visto.reduce((a, b) => a + b, 0)).toBe(85);
    expect(Math.max(...visto)).toBeLessThanOrEqual(TETO_IDS_POR_LOTE);
  });

  it("board não monta .in() com a lista inteira de cards", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/v1/pipelines/[id]/board/route.ts"),
      "utf8",
    );
    expect(src).toContain("consultarInEmLotes");
    expect(src).not.toMatch(/\.in\(\s*"lead_id",\s*leads\.map/);
    expect(src).not.toMatch(/\.in\(\s*"contact_id",\s*contactIds/);
    expect(src).not.toMatch(/lead_id\.in\.\(/);
  });
});
