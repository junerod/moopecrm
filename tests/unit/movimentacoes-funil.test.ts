import { describe, expect, it } from "vitest";

import {
  listarMovimentacoesDoFunil,
  montarMovimentacao,
} from "@/lib/home/movimentacoes-funil";
import {
  CHAVE_VISTO_FUNIL,
  contarNaoVistas,
  lidoEmMs,
  marcarAlteracoesVistas,
} from "@/lib/home/visto-alteracoes-funil";

describe("montarMovimentacao", () => {
  it("usa o reason da timeline e o título do negócio, sem inventar etapa", () => {
    expect(
      montarMovimentacao(
        {
          id: "a1",
          lead_id: "l1",
          reason: "Movido de Novo para Proposta",
          performed_at: "2026-11-13T12:00:00.000Z",
        },
        { id: "l1", title: "Maria", owner_user_id: "u1" },
      ),
    ).toEqual({
      activity_id: "a1",
      lead_id: "l1",
      titulo: "Maria",
      texto: "Movido de Novo para Proposta",
      em: "2026-11-13T12:00:00.000Z",
    });
  });
});

describe("listarMovimentacoesDoFunil", () => {
  it("filtra o tenant, o tipo stage_changed, e o dono quando soDoDono", async () => {
    const visto: string[] = [];
    const atividades = [
      {
        id: "a1",
        lead_id: "lead-meu",
        reason: "Movido de Novo para Proposta",
        performed_at: "2026-11-13T12:00:00.000Z",
      },
      {
        id: "a2",
        lead_id: "lead-outro",
        reason: "Movido de Proposta para Ganho",
        performed_at: "2026-11-13T11:00:00.000Z",
      },
    ];
    const leads = [
      { id: "lead-meu", title: "Maria", owner_user_id: "user-1" },
      { id: "lead-outro", title: "João", owner_user_id: "user-2" },
    ];
    const db = {
      from(tabela: string) {
        if (tabela === "crm_lead_activities") {
          return {
            select() {
              return this;
            },
            eq(col: string, val: unknown) {
              visto.push(`${col}=${String(val)}`);
              return this;
            },
            gte() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return Promise.resolve({ data: atividades, error: null });
            },
          };
        }
        return {
          select() {
            return this;
          },
          eq(col: string, val: unknown) {
            visto.push(`lead.${col}=${String(val)}`);
            return this;
          },
          in() {
            return Promise.resolve({ data: leads, error: null });
          },
        };
      },
    };
    const minhas = await listarMovimentacoesDoFunil(db as never, {
      organizationId: "org-a",
      userId: "user-1",
      soDoDono: true,
      agora: new Date("2026-11-13T15:00:00.000Z"),
    });
    expect(visto).toContain("organization_id=org-a");
    expect(visto).toContain("type=stage_changed");
    expect(minhas).toHaveLength(1);
    expect(minhas[0]?.titulo).toBe("Maria");

    const todas = await listarMovimentacoesDoFunil(db as never, {
      organizationId: "org-a",
      userId: "user-1",
      soDoDono: false,
      agora: new Date("2026-11-13T15:00:00.000Z"),
    });
    expect(todas).toHaveLength(2);
  });
});

describe("visto das alterações do funil", () => {
  it("conta só o que chegou depois do último olhar", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const itens = [
      { em: "2026-11-13T12:00:00.000Z" },
      { em: "2026-11-13T10:00:00.000Z" },
    ];
    expect(contarNaoVistas(itens, null)).toBe(2);
    marcarAlteracoesVistas(storage, new Date("2026-11-13T11:00:00.000Z"));
    expect(lidoEmMs(storage)).toBe(Date.parse("2026-11-13T11:00:00.000Z"));
    expect(contarNaoVistas(itens, lidoEmMs(storage))).toBe(1);
    expect(mem.get(CHAVE_VISTO_FUNIL)).toBe("2026-11-13T11:00:00.000Z");
  });
});
