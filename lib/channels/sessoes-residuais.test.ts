import { describe, expect, it } from "vitest";

import { deriveOverallHealth } from "@/hooks/channels/useChannelSessions";
import { STATUS_QUE_AVISAM } from "@/lib/channels/health";
import {
  ehResidualSupersedida,
  ehSessaoSupersedida,
  filtrarCaidasParaFaixa,
  orgTemSessaoWorking,
} from "@/lib/channels/sessoes-residuais";
import { readFileSync } from "node:fs";

function s(
  id: string,
  status: string,
  phone: string | null = null,
): { id: string; status: string; phone_number: string | null } {
  return { id, status, phone_number: phone };
}

describe("cenário A — WORKING + residual FAILED", () => {
  const lista = [s("viva", "WORKING", "5511999"), s("lixo", "FAILED")];

  it("a residual não é anunciada na faixa", () => {
    expect(filtrarCaidasParaFaixa(lista)).toEqual([]);
  });

  it("o status principal é conectado", () => {
    expect(orgTemSessaoWorking(lista)).toBe(true);
    expect(ehResidualSupersedida(lista[1]!, lista)).toBe(true);
    expect(deriveOverallHealth(lista as never)).toBe("connected");
  });
});

describe("cenário B — WORKING + residual SCAN_QR_CODE", () => {
  const lista = [s("viva", "WORKING", "5511999"), s("lixo", "SCAN_QR_CODE")];

  it("a residual não força QR na faixa", () => {
    expect(filtrarCaidasParaFaixa(lista)).toEqual([]);
    expect(deriveOverallHealth(lista as never)).toBe("connected");
  });
});

describe("cenário C — sem WORKING, só FAILED", () => {
  const lista = [s("unica", "FAILED")];

  it("mostra desconectado — falha real não é mascarada", () => {
    expect(ehResidualSupersedida(lista[0]!, lista)).toBe(false);
    expect(filtrarCaidasParaFaixa(lista)).toEqual(lista);
    expect(deriveOverallHealth(lista as never)).toBe("down");
  });
});

describe("cenário D — sem WORKING, SCAN_QR_CODE válido", () => {
  const lista = [s("pareando", "SCAN_QR_CODE")];

  it("o fluxo de QR continua disponível", () => {
    expect(ehResidualSupersedida(lista[0]!, lista)).toBe(false);
    expect(filtrarCaidasParaFaixa(lista)).toEqual(lista);
    expect(deriveOverallHealth(lista as never)).toBe("connecting");
  });
});

describe("cenário E — dois números legítimos", () => {
  it("WORKING + FAILED com telefone: o caído continua caído", () => {
    const lista = [
      s("vendas", "WORKING", "5511111"),
      s("suporte", "FAILED", "5511222"),
    ];
    expect(ehResidualSupersedida(lista[1]!, lista)).toBe(false);
    expect(filtrarCaidasParaFaixa(lista).map((x) => x.id)).toEqual(["suporte"]);
    expect(deriveOverallHealth(lista as never)).toBe("down");
  });

  it("dois WORKING: conectado — a regra não força uma sessão por org", () => {
    const lista = [
      s("vendas", "WORKING", "5511111"),
      s("suporte", "WORKING", "5511222"),
    ];
    expect(filtrarCaidasParaFaixa(lista)).toEqual([]);
    expect(deriveOverallHealth(lista as never)).toBe("connected");
  });

  it("ordem do array não decide: residual no começo não ganha", () => {
    const lista = [s("lixo", "FAILED"), s("viva", "WORKING", "5511999")];
    expect(filtrarCaidasParaFaixa(lista)).toEqual([]);
    expect(deriveOverallHealth(lista as never)).toBe("connected");
  });
});

describe("cenário F — mesmo número em duas sessões (o defeito medido em produção)", () => {
  const lista = [
    s("arquivo", "STOPPED", "556194114879"),
    s("viva", "WORKING", "556194114879"),
  ];

  it("a sessão antiga NÃO é residual — ela tem telefone", () => {
    expect(ehResidualSupersedida(lista[0]!, lista)).toBe(false);
  });

  it("mas está supersedida: o número JÁ está WORKING na irmã", () => {
    expect(ehSessaoSupersedida(lista[0]!, lista)).toBe(true);
    expect(filtrarCaidasParaFaixa(lista)).toEqual([]);
    expect(deriveOverallHealth(lista as never)).toBe("connected");
  });

  it("+55 e só dígitos são o mesmo número", () => {
    const comMais = [
      s("arquivo", "FAILED", "+55 61 94114-4879"),
      s("viva", "WORKING", "5561941144879"),
    ];
    expect(ehSessaoSupersedida(comMais[0]!, comMais)).toBe(true);
    expect(filtrarCaidasParaFaixa(comMais)).toEqual([]);
  });

  it("dois FAILED do mesmo número, sem WORKING: continua anunciando — falha real", () => {
    const soCaidas = [
      s("a", "FAILED", "556194114879"),
      s("b", "STOPPED", "556194114879"),
    ];
    expect(filtrarCaidasParaFaixa(soCaidas).map((x) => x.id)).toEqual(["a", "b"]);
    expect(deriveOverallHealth(soCaidas as never)).toBe("down");
  });
});

describe("a lista de caídos é a mesma do aviso", () => {
  it("STATUS_CAIDO em sessoes-residuais === STATUS_QUE_AVISAM", () => {
    const src = readFileSync("lib/channels/sessoes-residuais.ts", "utf8");
    const m = src.match(/const STATUS_CAIDO = \[([^\]]+)\]/);
    expect(m, "STATUS_CAIDO sumiu").toBeTruthy();
    const lidos = [...(m?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(lidos).toEqual([...STATUS_QUE_AVISAM]);
  });
});
