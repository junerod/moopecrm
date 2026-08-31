/**
 * O perfil de escritório — o que o wizard sozinho não entrega.
 *
 * O pacote do onboarding é um quadro. Este teste guarda o resto: o segundo
 * funil, o vocabulário (Cliente/Caso, não Pedido/Pago) e os campos que o
 * advogado preenche. Sem isto, o provisionar na VPS nasce de um objeto que
 * ninguém validou.
 */
import { describe, expect, it } from "vitest";

import { coberturaDoFunil, PASSOS_QUE_PRECISAM_DE_ETAPA } from "@/lib/leads/agent-mapping";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";
import {
  CAMPOS_NOVOS_CLIENTES,
  CAMPOS_PROCESSOS,
  FUNIL_PROCESSOS,
  MOTIVOS_DE_PERDA,
  PACOTE_ADVOCACIA,
  TIPOS_DE_AGENDA,
  VOCABULARIO_NOVOS_CLIENTES,
  VOCABULARIO_PROCESSOS,
} from "@/lib/onboarding/perfil-advocacia";
import { validarProposta } from "@/lib/onboarding/proposta-de-funil";
import { pipelineConfigPatchSchema } from "@/lib/schemas/settings";

describe("perfil de escritório de advocacia", () => {
  it("o pacote do wizard e o segundo funil passam no validador", () => {
    expect(validarProposta(PACOTE_ADVOCACIA.proposta).ok).toBe(true);
    expect(validarProposta(FUNIL_PROCESSOS).ok).toBe(true);
  });

  it("os dois quadros ensinam o funcionário a percorrer o funil inteiro", () => {
    for (const proposta of [PACOTE_ADVOCACIA.proposta, FUNIL_PROCESSOS]) {
      const cobertura = coberturaDoFunil(
        proposta.etapas.map((e, i) => ({
          id: String(i),
          name: e.nome,
          is_won: e.passo === "won",
          is_lost: e.passo === "lost",
          agent_stage_hint: e.passo,
        })),
      );
      expect(cobertura.faltando, proposta.nome).toEqual([]);
      expect(cobertura.traduzidos, proposta.nome).toBe(PASSOS_QUE_PRECISAM_DE_ETAPA.length);
    }
  });

  it("fala a língua do escritório, não a de loja", () => {
    expect(PACOTE_ADVOCACIA.comoSeApresenta).toMatch(/advocacia/i);
    expect(PACOTE_ADVOCACIA.proposta.nome).toBe("Novos clientes");
    expect(PACOTE_ADVOCACIA.proposta.etapas.map((e) => e.nome)).toContain("Honorários");
    expect(PACOTE_ADVOCACIA.proposta.etapas.map((e) => e.nome)).toContain("Contratou");
    expect(FUNIL_PROCESSOS.nome).toBe("Processos");
    expect(VOCABULARIO_NOVOS_CLIENTES.deal).toBe("Caso");
    expect(VOCABULARIO_NOVOS_CLIENTES.won).toBe("Contratou");
    expect(VOCABULARIO_PROCESSOS.deal).toBe("Processo");
    expect(VOCABULARIO_PROCESSOS.won).toBe("Encerrado");
  });

  it("os campos e os motivos de perda cabem no schema da tela de funis", () => {
    const captação = pipelineConfigPatchSchema.safeParse({
      vocabulary: {
        lead: VOCABULARIO_NOVOS_CLIENTES.lead,
        deal: VOCABULARIO_NOVOS_CLIENTES.deal,
        won: VOCABULARIO_NOVOS_CLIENTES.won,
        lost: VOCABULARIO_NOVOS_CLIENTES.lost,
      },
      fields: CAMPOS_NOVOS_CLIENTES,
      lost_reasons: MOTIVOS_DE_PERDA,
    });
    expect(captação.success, JSON.stringify(captação.error?.issues)).toBe(true);

    const processos = pipelineConfigPatchSchema.safeParse({
      vocabulary: {
        lead: VOCABULARIO_PROCESSOS.lead,
        deal: VOCABULARIO_PROCESSOS.deal,
        won: VOCABULARIO_PROCESSOS.won,
        lost: VOCABULARIO_PROCESSOS.lost,
      },
      fields: CAMPOS_PROCESSOS,
      lost_reasons: MOTIVOS_DE_PERDA,
    });
    expect(processos.success, JSON.stringify(processos.error?.issues)).toBe(true);
  });

  it("os tipos de agenda usam categoria que o banco já aceita", () => {
    const categoriasOk = new Set(["consulta", "reuniao", "outro"]);
    for (const tipo of TIPOS_DE_AGENDA) {
      expect(categoriasOk.has(tipo.category), tipo.slug).toBe(true);
    }
    expect(TIPOS_DE_AGENDA.map((t) => t.slug)).toEqual([
      "consulta-inicial",
      "audiencia",
      "prazo",
    ]);
  });

  it("o pacote exportado aqui é o mesmo da lista do wizard", () => {
    expect(PACOTES.find((p) => p.id === "advocacia")).toEqual(PACOTE_ADVOCACIA);
  });
});
