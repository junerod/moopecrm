import { afterEach, describe, expect, it, vi } from "vitest";

import { metaDaLinha } from "@/lib/inbox/meta-da-linha";

describe("metaDaLinha", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("some quando não há lead nem passo", () => {
    expect(metaDaLinha({ papel: null, crm_leads: [], demandas: [] })).toBeNull();
  });

  it("mostra etapa do funil e declara ausência de passo", () => {
    const meta = metaDaLinha({
      papel: "lead",
      crm_leads: [
        {
          id: "l1",
          status: "open",
          crm_stages: { id: "s1", name: "Qualificado" },
        },
      ],
      demandas: [],
    });
    expect(meta).toMatchObject({
      etapa: "Qualificado",
      passo: null,
      semPasso: true,
      atrasado: false,
    });
  });

  it("junta etapa com próximo passo e marca atraso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T18:00:00.000Z"));
    const meta = metaDaLinha({
      papel: "lead",
      crm_leads: [
        {
          id: "l1",
          status: "open",
          crm_stages: { id: "s1", name: "Qualificado" },
        },
      ],
      demandas: [
        {
          estado: "aberta",
          proximo_passo: "Ligar para confirmar",
          proximo_passo_em: "2026-09-10T13:00:00.000Z",
        },
      ],
    });
    expect(meta?.etapa).toBe("Qualificado");
    expect(meta?.passo).toBe("Ligar para confirmar");
    expect(meta?.atrasado).toBe(true);
    expect(meta?.semPasso).toBe(false);
  });

  it("ignora lead fechado e cai no rótulo de papel", () => {
    const meta = metaDaLinha({
      papel: "cliente",
      crm_leads: [{ id: "l1", status: "won", crm_stages: { id: "s1", name: "Pago" } }],
    });
    expect(meta).toMatchObject({ etapa: "Cliente", semPasso: true });
  });
});
