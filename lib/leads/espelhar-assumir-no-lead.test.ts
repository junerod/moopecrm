import { describe, expect, it, vi } from "vitest";

import { espelharAssumirNoLeadAberto } from "./espelhar-assumir-no-lead";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const OUTRO = "44444444-4444-4444-8444-444444444444";
const AGENTE = "55555555-5555-4555-8555-555555555555";
const LEAD = "66666666-6666-4666-8666-666666666666";

function dbComAbertos(
  abertos: Array<{
    id: string;
    created_at: string;
    owner_user_id: string | null;
    owner_agent_id: string | null;
  }>,
  onUpdate?: (patch: Record<string, unknown>) => void,
) {
  return {
    from: (tabela: string) => {
      if (tabela !== "crm_leads") throw new Error(`tabela inesperada: ${tabela}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  order: () => Promise.resolve({ data: abertos, error: null }),
                }),
              }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          onUpdate?.(patch);
          return {
            eq: () => ({
              eq: () => ({
                is: () => ({
                  is: () => Promise.resolve({ error: null }),
                }),
              }),
            }),
          };
        },
      };
    },
  };
}

describe("espelharAssumirNoLeadAberto", () => {
  it("A — lead sem owner: preenche o humano que assumiu", async () => {
    let gravado: Record<string, unknown> | null = null;
    const r = await espelharAssumirNoLeadAberto(
      dbComAbertos(
        [
          {
            id: LEAD,
            created_at: "2026-09-01T00:00:00Z",
            owner_user_id: null,
            owner_agent_id: null,
          },
        ],
        (p) => {
          gravado = p;
        },
      ) as never,
      { organizationId: ORG, contactId: CONTATO, userId: USER },
    );
    expect(r).toEqual({ aplicado: true, leadId: LEAD });
    expect(gravado).toMatchObject({
      owner_user_id: USER,
      owner_agent_id: null,
      owner_kind: "user",
    });
  });

  it("B — lead com owner humano: NÃO sobrescreve", async () => {
    let gravou = false;
    const r = await espelharAssumirNoLeadAberto(
      dbComAbertos(
        [
          {
            id: LEAD,
            created_at: "2026-09-01T00:00:00Z",
            owner_user_id: OUTRO,
            owner_agent_id: null,
          },
        ],
        () => {
          gravou = true;
        },
      ) as never,
      { organizationId: ORG, contactId: CONTATO, userId: USER },
    );
    expect(r).toEqual({ aplicado: false, motivo: "ja_tem_humano" });
    expect(gravou).toBe(false);
  });

  it("C — lead com owner_agent_id: NÃO apaga o agente", async () => {
    let gravou = false;
    const r = await espelharAssumirNoLeadAberto(
      dbComAbertos(
        [
          {
            id: LEAD,
            created_at: "2026-09-01T00:00:00Z",
            owner_user_id: null,
            owner_agent_id: AGENTE,
          },
        ],
        () => {
          gravou = true;
        },
      ) as never,
      { organizationId: ORG, contactId: CONTATO, userId: USER },
    );
    expect(r).toEqual({ aplicado: false, motivo: "dono_agente" });
    expect(gravou).toBe(false);
  });

  it("dois OPEN: não escolhe em silêncio", async () => {
    const r = await espelharAssumirNoLeadAberto(
      dbComAbertos([
        {
          id: LEAD,
          created_at: "2026-09-01T00:00:00Z",
          owner_user_id: null,
          owner_agent_id: null,
        },
        {
          id: "77777777-7777-4777-8777-777777777777",
          created_at: "2026-09-02T00:00:00Z",
          owner_user_id: null,
          owner_agent_id: null,
        },
      ]) as never,
      { organizationId: ORG, contactId: CONTATO, userId: USER },
    );
    expect(r).toEqual({ aplicado: false, motivo: "varios" });
  });

  it("sem contato: não consulta", async () => {
    const from = vi.fn();
    const r = await espelharAssumirNoLeadAberto({ from } as never, {
      organizationId: ORG,
      contactId: null,
      userId: USER,
    });
    expect(r).toEqual({ aplicado: false, motivo: "sem_contato" });
    expect(from).not.toHaveBeenCalled();
  });
});
