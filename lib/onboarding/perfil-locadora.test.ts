/**
 * O perfil de locadora — o que o wizard sozinho não entrega.
 *
 * O pacote do onboarding é um quadro. Este teste guarda o resto: o segundo
 * funil (Cobrança), o vocabulário (Locatário/Contrato) e os campos do caso.
 */
import { describe, expect, it } from "vitest";

import { coberturaDoFunil, PASSOS_QUE_PRECISAM_DE_ETAPA } from "@/lib/leads/agent-mapping";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";
import {
  CAMPOS_COBRANCA,
  CAMPOS_LOCATARIOS,
  FUNIL_COBRANCA,
  MOTIVOS_DE_PERDA_LOCADORA,
  PACOTE_LOCADORA,
  VOCABULARIO_COBRANCA,
  VOCABULARIO_LOCATARIOS,
} from "@/lib/onboarding/perfil-locadora";
import { validarProposta } from "@/lib/onboarding/proposta-de-funil";
import { pipelineConfigPatchSchema } from "@/lib/schemas/settings";

describe("perfil de locadora", () => {
  it("o pacote do wizard e o segundo funil passam no validador", () => {
    expect(validarProposta(PACOTE_LOCADORA.proposta).ok).toBe(true);
    expect(validarProposta(FUNIL_COBRANCA).ok).toBe(true);
  });

  it("o quadro de locatários ensina o funcionário a percorrer o funil inteiro", () => {
    const cobertura = coberturaDoFunil(
      PACOTE_LOCADORA.proposta.etapas.map((e, i) => ({
        id: String(i),
        name: e.nome,
        is_won: e.passo === "won",
        is_lost: e.passo === "lost",
        agent_stage_hint: e.passo,
      })),
    );
    expect(cobertura.faltando).toEqual([]);
    expect(cobertura.traduzidos).toBe(PASSOS_QUE_PRECISAM_DE_ETAPA.length);
  });

  it("fala a língua da locadora, não a de loja", () => {
    expect(PACOTE_LOCADORA.comoSeApresenta).toMatch(/locadora/i);
    expect(PACOTE_LOCADORA.proposta.nome).toBe("Locatários");
    expect(PACOTE_LOCADORA.proposta.etapas.map((e) => e.nome)).toContain("Contrato ativo");
    expect(FUNIL_COBRANCA.nome).toBe("Cobrança");
    expect(VOCABULARIO_LOCATARIOS.lead).toBe("Locatário");
    expect(VOCABULARIO_LOCATARIOS.deal).toBe("Contrato");
    expect(VOCABULARIO_COBRANCA.won).toBe("Recuperou");
  });

  it("os campos e os motivos de perda cabem no schema da tela de funis", () => {
    const locatarios = pipelineConfigPatchSchema.safeParse({
      vocabulary: {
        lead: VOCABULARIO_LOCATARIOS.lead,
        deal: VOCABULARIO_LOCATARIOS.deal,
        won: VOCABULARIO_LOCATARIOS.won,
        lost: VOCABULARIO_LOCATARIOS.lost,
      },
      fields: CAMPOS_LOCATARIOS,
      lost_reasons: MOTIVOS_DE_PERDA_LOCADORA,
    });
    expect(locatarios.success, JSON.stringify(locatarios.error?.issues)).toBe(true);

    const cobranca = pipelineConfigPatchSchema.safeParse({
      vocabulary: {
        lead: VOCABULARIO_COBRANCA.lead,
        deal: VOCABULARIO_COBRANCA.deal,
        won: VOCABULARIO_COBRANCA.won,
        lost: VOCABULARIO_COBRANCA.lost,
      },
      fields: CAMPOS_COBRANCA,
      lost_reasons: MOTIVOS_DE_PERDA_LOCADORA,
    });
    expect(cobranca.success, JSON.stringify(cobranca.error?.issues)).toBe(true);
  });

  it("o pacote exportado aqui é o mesmo da lista do wizard", () => {
    expect(PACOTES.find((p) => p.id === "locadora")).toEqual(PACOTE_LOCADORA);
  });
});
