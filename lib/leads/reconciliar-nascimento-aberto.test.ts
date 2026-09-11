import { describe, expect, it } from "vitest";

import { reconciliarNascimentoAberto } from "./reconciliar-nascimento-aberto";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const ANTIGO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOVO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function db(abertos: Array<{ id: string; created_at: string }>, apagados: string[]) {
  const resultado = Promise.resolve({ error: null });
  const filtro = {
    eq: (col: string, v: string) => {
      if (col === "id") apagados.push(v);
      return Object.assign(filtro, {
        then: resultado.then.bind(resultado),
      });
    },
  };
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    data: abertos.map((a) => ({
                      ...a,
                      owner_user_id: null,
                      owner_agent_id: null,
                    })),
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
      delete: () => filtro,
    }),
  };
}

describe("reconciliarNascimentoAberto", () => {
  it("se o criado é o mais antigo, mantém", async () => {
    const apagados: string[] = [];
    const r = await reconciliarNascimentoAberto(db([{ id: NOVO, created_at: "2026-09-10T10:00:00Z" }], apagados) as never, {
      organizationId: ORG,
      contactId: CONTATO,
      leadIdCriado: NOVO,
    });
    expect(r).toEqual({ manteve: true, leadId: NOVO });
    expect(apagados).toEqual([]);
  });

  it("se perdeu a corrida, apaga o card acidental e devolve o mais antigo", async () => {
    const apagados: string[] = [];
    const r = await reconciliarNascimentoAberto(
      db(
        [
          { id: ANTIGO, created_at: "2026-09-10T09:59:59Z" },
          { id: NOVO, created_at: "2026-09-10T10:00:00Z" },
        ],
        apagados,
      ) as never,
      { organizationId: ORG, contactId: CONTATO, leadIdCriado: NOVO },
    );
    expect(r).toEqual({ manteve: false, leadId: ANTIGO });
    expect(apagados).toContain(NOVO);
    expect(apagados).not.toContain(ANTIGO);
  });
});
