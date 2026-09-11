import { describe, expect, it } from "vitest";

import {
  escolherPipelineDeNascimento,
  idEfetivoDeNovosLeads,
  lerInboundPipelineId,
  mesclarCrmSettings,
  semearInboundSeAusente,
} from "./funil-de-nascimento";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("lerInboundPipelineId", () => {
  it("ausente ou inválido é 'não configurado'", () => {
    expect(lerInboundPipelineId(undefined)).toBeNull();
    expect(lerInboundPipelineId({})).toBeNull();
    expect(lerInboundPipelineId({ crm: {} })).toBeNull();
    expect(lerInboundPipelineId({ crm: { inbound_pipeline_id: null } })).toBeNull();
    expect(lerInboundPipelineId({ crm: { inbound_pipeline_id: "COMERCIAL MOOPE" } })).toBeNull();
    expect(lerInboundPipelineId({ crm: { inbound_pipeline_id: "nao-e-uuid" } })).toBeNull();
  });

  it("lê uuid sem hardcode de nome de funil", () => {
    expect(lerInboundPipelineId({ crm: { inbound_pipeline_id: B } })).toBe(B);
  });
});

describe("escolherPipelineDeNascimento", () => {
  it("A. sem inbound cai no is_default", () => {
    expect(
      escolherPipelineDeNascimento({
        inboundPipelineId: null,
        inboundEhValido: false,
        defaultPipelineId: A,
      }),
    ).toEqual({ pipelineId: A });
  });

  it("B. inbound válido vence o default", () => {
    expect(
      escolherPipelineDeNascimento({
        inboundPipelineId: B,
        inboundEhValido: true,
        defaultPipelineId: A,
      }),
    ).toEqual({ pipelineId: B });
  });

  it("C. inbound inválido/arquivado cai no default", () => {
    expect(
      escolherPipelineDeNascimento({
        inboundPipelineId: B,
        inboundEhValido: false,
        defaultPipelineId: A,
      }),
    ).toEqual({ pipelineId: A });
  });

  it("não escolhe funil arbitrário quando nada serve", () => {
    expect(
      escolherPipelineDeNascimento({
        inboundPipelineId: ORG_B,
        inboundEhValido: false,
        defaultPipelineId: null,
      }),
    ).toEqual({ erro: "sem_funil_de_entrada" });
  });
});

describe("idEfetivoDeNovosLeads", () => {
  const funis = [
    { id: A, is_default: true },
    { id: B, is_default: false },
  ];

  it("mostra o inbound quando ele ainda está na lista", () => {
    expect(idEfetivoDeNovosLeads(funis, B)).toBe(B);
  });

  it("inbound arquivado some da lista — mostra o padrão", () => {
    expect(idEfetivoDeNovosLeads(funis, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBe(A);
  });
});

describe("Ready Model não sobrescreve escolha", () => {
  it("semeia só quando a chave está ausente", () => {
    const vazio = semearInboundSeAusente({}, B);
    expect(lerInboundPipelineId(vazio)).toBe(B);

    const jaEscolheu = semearInboundSeAusente({ crm: { inbound_pipeline_id: A } }, B);
    expect(lerInboundPipelineId(jaEscolheu)).toBe(A);
  });

  it("merge não apaga outras chaves de settings.crm", () => {
    const next = mesclarCrmSettings({ crm: { outro: 1 }, ai_mode: "off" }, B);
    expect(next.ai_mode).toBe("off");
    expect((next.crm as { outro: number; inbound_pipeline_id: string }).outro).toBe(1);
    expect(lerInboundPipelineId(next)).toBe(B);
  });
});
