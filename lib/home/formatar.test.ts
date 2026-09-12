import { describe, expect, it } from "vitest";

import {
  deltaAbsoluto,
  deltaPercentual,
  deltaPontos,
  esperaAnomala,
  formatarConversao,
  formatarConversaoFina,
  formatarEspera,
  formatarValorEtapa,
  primeiroNome,
  saudacaoDoDia,
} from "@/lib/home/formatar";
import { insightsDoSnapshot } from "@/lib/home/insights";
import type { SnapshotDaHome } from "@/lib/home/tipos";
import { ehGestor } from "@/lib/home/tipos";

describe("home/formatar", () => {
  it("espera nula ou zero não vira número inventado", () => {
    expect(formatarEspera(null)).toBe("—");
    expect(formatarEspera(0)).toBe("—");
    expect(formatarEspera(45)).toBe("45s");
    expect(formatarEspera(120)).toBe("2 min");
  });

  it("espera longa vira dias, nunca 332 h", () => {
    expect(formatarEspera(3 * 3600 + 18 * 60)).toBe("3h 18min");
    expect(formatarEspera(332 * 3600 + 31 * 60)).toBe("13d 20h");
    expect(formatarEspera(332 * 3600 + 31 * 60)).not.toMatch(/332/);
    expect(esperaAnomala(18 * 60)).toBe(false);
    expect(esperaAnomala(26 * 3600)).toBe(true);
  });

  it("valor da etapa some quando não há cents", () => {
    expect(formatarValorEtapa(0)).toBeNull();
    expect(formatarValorEtapa(3200000)).toMatch(/R\$/);
  });

  it("conversão nula não vira 0%", () => {
    expect(formatarConversao(null)).toBe("—");
    expect(formatarConversao(0.22)).toBe("22%");
  });

  it("saudação e primeiro nome não inventam pessoa", () => {
    expect(primeiroNome("João Silva")).toBe("João");
    expect(primeiroNome("  ")).toBeNull();
    expect(saudacaoDoDia(new Date("2026-09-12T15:00:00"))).toBe("Boa tarde");
  });

  it("delta só existe com base anterior confiável", () => {
    expect(deltaPercentual(42, 0)).toBeNull();
    expect(deltaPercentual(42, 36)?.texto).toMatch(/↑ 17%/);
    expect(deltaAbsoluto(11, 7)?.texto).toBe("↑ 4");
    expect(deltaPontos(0.248, 0.216)?.texto).toMatch(/3,2 p.p./);
    expect(formatarConversaoFina(0.248)).toBe("24,8%");
  });
});

describe("home/insights", () => {
  it("não inventa causalidade e limita a 3 frases", () => {
    const snap = {
      papel: "manager",
      personal: { atrasadas: 3, quentes_sem_acao: 5, hoje: 0, conversas_minhas: 0, acoes: [], compromissos: [] },
      team: { fila: 8, espera_mais_antiga_s: 18 * 60, primeira_resposta_media_s: null, conversas_abertas: 0, disponiveis: 0, pessoas: [] },
      commercial: {
        leads_novos: 0, oportunidades_abertas: 0, ganhos: 0, perdidos: 0,
        conversao: 0.25, sem_proxima_acao: 0, atrasadas: 0, paradas: 0,
        vs_anterior: { leads_novos: 0, ganhos: 0, conversao: 0.22, primeira_resposta_media_s: null },
      },
    } as SnapshotDaHome;
    const frases = insightsDoSnapshot(snap).map((i) => i.texto);
    expect(frases).toHaveLength(3);
    expect(frases[0]).toMatch(/3 retornos vencidos/);
    expect(frases[1]).toMatch(/5 leads quentes/);
    expect(frases[2]).toMatch(/18 min/);
  });
});

describe("home/papel", () => {
  it("só manager e admin veem bloco gerencial", () => {
    expect(ehGestor("agent")).toBe(false);
    expect(ehGestor("viewer")).toBe(false);
    expect(ehGestor("manager")).toBe(true);
    expect(ehGestor("admin")).toBe(true);
  });
});
