/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { encerrarFila, STATUS_EM_TRABALHO } from "@/lib/inbox/encerrar-fila";
import { esvaziarFunil } from "@/lib/leads/esvaziar-funil";

function clienteComLotes(lotes: string[][]) {
  const fila = [...lotes];
  const updates: unknown[] = [];
  const deletes: string[][] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                in() {
                  return {
                    async limit() {
                      const ids = fila.shift() ?? [];
                      return { data: ids.map((id) => ({ id })), error: null };
                    },
                  };
                },
                async limit() {
                  const ids = fila.shift() ?? [];
                  return { data: ids.map((id) => ({ id })), error: null };
                },
              };
            },
          };
        },
        update(payload: unknown) {
          updates.push({ table, payload });
          const fim = { error: null };
          return {
            in() {
              return {
                eq() {
                  return Object.assign(Promise.resolve(fim), {
                    is: async () => fim,
                  });
                },
              };
            },
          };
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              deletes.push(ids);
              return {
                eq: async () => ({ error: null, count: ids.length }),
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, updates, deletes };
}

describe("encerrar fila", () => {
  it("fecha só o que ainda está em trabalho, em lotes", async () => {
    const { client, updates } = clienteComLotes([["a", "b"], ["c"], []]);
    const r = await encerrarFila(client, "org-1");
    expect(r.encerradas).toBe(3);
    expect(updates.filter((u) => (u as { payload: { status?: string } }).payload.status === "closed")).toHaveLength(2);
    expect(STATUS_EM_TRABALHO).toContain("open");
    expect(STATUS_EM_TRABALHO).not.toContain("closed");
  });
});

describe("esvaziar funil", () => {
  it("recusa sem a palavra ZERAR e não apaga nada", async () => {
    const { client, deletes } = clienteComLotes([]);
    await expect(esvaziarFunil(client, "org-1", "sim")).rejects.toThrow(/ZERAR/);
    expect(deletes).toEqual([]);
  });

  it("apaga os cards em lotes quando a confirmação é ZERAR", async () => {
    const { client, deletes } = clienteComLotes([["l1", "l2"], []]);
    const r = await esvaziarFunil(client, "org-1", "ZERAR");
    expect(r.apagados).toBe(2);
    expect(deletes).toEqual([["l1", "l2"]]);
  });
});

describe("reabrir no inbound", () => {
  it("a função do banco devolve conversa encerrada para a fila", () => {
    const sql = readFileSync(
      "supabase/migrations/20261002120000_0212_reabre_conversa_fechada_no_inbound.sql",
      "utf8",
    );
    expect(sql).toContain("status in ('closed', 'archived', 'resolved') then 'open'");
    expect(sql).toContain("p_direction = 'inbound'");
    expect(readFileSync("supabase/baseline.sql", "utf8")).toContain(
      "status in ('closed', 'archived', 'resolved') then 'open'",
    );
  });
});

describe("só admin", () => {
  it("as duas rotas exigem admin", () => {
    for (const path of [
      "app/api/v1/conversations/bulk-close/route.ts",
      "app/api/v1/leads/reset-board/route.ts",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('requireRole("admin"');
    }
  });
});
