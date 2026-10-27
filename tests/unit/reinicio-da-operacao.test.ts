/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { encerrarFila, STATUS_EM_TRABALHO } from "@/lib/inbox/encerrar-fila";
import { limparCaixa } from "@/lib/inbox/limpar-caixa";
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

type Linha = { id: string; media_storage_path?: string | null };

/**
 * Um cliente que entrega lotes por tabela e anota a ordem das escritas.
 * `limit()` consome o próximo lote daquela tabela.
 */
function clienteDeLimpeza(lotes: Record<string, Linha[][]>, falhaUpsert = false) {
  const log: { op: string; table: string }[] = [];
  const upserts: { object_path: string; organization_id: string }[] = [];
  const orgs = new Set<string>();
  const client = {
    from(table: string) {
      const fila = lotes[table] ?? [];
      return {
        select() {
          log.push({ op: "select", table });
          const chain = {
            eq(_col: string, val: string) {
              orgs.add(val);
              return chain;
            },
            in() {
              return chain;
            },
            not() {
              return chain;
            },
            order() {
              return chain;
            },
            gt() {
              return chain;
            },
            async limit() {
              return { data: fila.shift() ?? [], error: null };
            },
          };
          return chain;
        },
        update() {
          log.push({ op: "update", table });
          const chain = {
            in() {
              return chain;
            },
            eq(_col: string, val: string) {
              orgs.add(val);
              return Promise.resolve({ error: null });
            },
          };
          return chain;
        },
        delete() {
          log.push({ op: "delete", table });
          const chain = {
            in() {
              return chain;
            },
            eq(_col: string, val: string) {
              orgs.add(val);
              return Promise.resolve({ error: null });
            },
          };
          return chain;
        },
        upsert(rows: { object_path: string; organization_id: string }[]) {
          log.push({ op: "upsert", table });
          upserts.push(...rows);
          return Promise.resolve(falhaUpsert ? { error: { message: "fila cheia" } } : { error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, log, upserts, orgs };
}

describe("limpar caixa", () => {
  it("recusa sem a palavra LIMPAR e não apaga nada", async () => {
    const { client, log } = clienteDeLimpeza({
      conversations: [[{ id: "a" }]],
    });
    await expect(limparCaixa(client, "org-1", "sim")).rejects.toThrow(/LIMPAR/);
    expect(log).toEqual([]);
  });

  it("enfileira a mídia antes de apagar, para o acompanhamento e zera a caixa em lotes", async () => {
    const { client, log, upserts, orgs } = clienteDeLimpeza({
      messages: [[{ id: "m1", media_storage_path: "org-1/c/m1.jpg" }], []],
      followup_enrollments: [[{ id: "f1" }], []],
      agent_inbox_items: [[{ id: "v1" }], []],
      conversations: [[{ id: "a" }, { id: "b" }], []],
    });
    const r = await limparCaixa(client, "org-1", "LIMPAR");
    expect(r).toEqual({ apagadas: 2, acompanhamentos: 1, midias: 1, avisos: 1 });
    expect(upserts).toEqual([
      expect.objectContaining({
        object_path: "org-1/c/m1.jpg",
        organization_id: "org-1",
        bucket: "whatsapp-media",
        request_id: null,
      }),
    ]);
    const escritas = log.filter((e) => e.op !== "select").map((e) => `${e.op}:${e.table}`);
    expect(escritas).toEqual([
      "upsert:storage_redaction_queue",
      "update:followup_enrollments",
      "delete:agent_inbox_items",
      "delete:conversations",
    ]);
    expect(orgs.has("org-1")).toBe(true);
    expect([...orgs].every((o) => o === "org-1")).toBe(true);
  });

  it("não apaga conversa se a fila de mídia recusar o arquivo", async () => {
    const { client, log } = clienteDeLimpeza(
      { messages: [[{ id: "m1", media_storage_path: "org-1/c/m1.jpg" }]] },
      true,
    );
    await expect(limparCaixa(client, "org-1", " LIMPAR ")).rejects.toThrow(/fila cheia/);
    expect(log.some((e) => e.table === "conversations")).toBe(false);
  });

  it("para se o mesmo id voltar — senão o lote que não saiu vira laço", async () => {
    const { client, log } = clienteDeLimpeza({
      messages: [[]],
      followup_enrollments: [[]],
      agent_inbox_items: [[]],
      conversations: [[{ id: "stuck" }], [{ id: "stuck" }]],
    });
    await expect(limparCaixa(client, "org-1", "LIMPAR")).rejects.toThrow(/caixa/);
    expect(log.filter((e) => e.op === "delete" && e.table === "conversations")).toHaveLength(1);
  });
});

describe("só admin", () => {
  it("as rotas de recomeço exigem admin", () => {
    for (const path of [
      "app/api/v1/conversations/bulk-close/route.ts",
      "app/api/v1/leads/reset-board/route.ts",
      "app/api/v1/conversations/purge-inbox/route.ts",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('requireRole("admin"');
    }
  });

  it("limpar a caixa lê a empresa da sessão, não do corpo", () => {
    const src = readFileSync("app/api/v1/conversations/purge-inbox/route.ts", "utf8");
    expect(src).toContain("authz.org.orgId");
    expect(src).toContain("z.object({ confirm: z.string() }).strict()");
    expect(src).not.toMatch(/parsed\.data\.organization|body\.organization|json\.organization/);
  });
});
