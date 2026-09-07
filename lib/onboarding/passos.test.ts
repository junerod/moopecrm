/**
 * O wizard não pode culpar a pessoa por uma tela que nunca lhe ofereceu.
 */
import { describe, expect, it } from "vitest";

import {
  passoAnterior,
  passosVisiveis,
  proximoPasso,
  resumoDoOnboarding,
  type ContextoDoPasso,
} from "@/lib/onboarding/passos";
import type { OnboardingState } from "@/lib/schemas/onboarding";

const SEM_LOJA: ContextoDoPasso = { lojaLigada: false };
const COM_LOJA: ContextoDoPasso = { lojaLigada: true };
const VAZIO: OnboardingState = {};

const ORDEM = [
  "welcome",
  "connect-whatsapp",
  "quem-atende",
  "funil",
  "follow-up",
  "setup-ai",
  "invite-team",
];

describe("passos visíveis", () => {
  it("não oferece Nuvemshop nem o ensaio do agente", () => {
    const segmentos = passosVisiveis(SEM_LOJA).map((p) => p.segmento);
    expect(segmentos).toEqual(ORDEM);
    expect(segmentos).not.toContain("connect-nuvemshop");
    expect(segmentos).not.toContain("testar");
  });

  it("mesmo com a loja ligada o wizard não oferece Nuvemshop", () => {
    expect(passosVisiveis(COM_LOJA).map((p) => p.segmento)).toEqual(ORDEM);
  });
});

describe("próximo passo", () => {
  it("começa no primeiro", () => {
    expect(proximoPasso(VAZIO, SEM_LOJA)?.segmento).toBe("welcome");
  });

  it("depois do WhatsApp vem quem atende — não o agente", () => {
    const s: OnboardingState = {
      welcome: { accepted_at: "x", timezone: "America/Sao_Paulo", display_name: "N" },
      whatsapp: { status: "WORKING" },
    };
    expect(proximoPasso(s, SEM_LOJA)?.segmento).toBe("quem-atende");
  });

  it("passo PULADO conta como resolvido", () => {
    const s: OnboardingState = {
      welcome: { accepted_at: "x", timezone: "America/Sao_Paulo", display_name: "N" },
      whatsapp: { status: "skipped", skipped: true },
    };
    expect(proximoPasso(s, SEM_LOJA)?.segmento).toBe("quem-atende");
  });

  it("tudo resolvido = não falta nenhum", () => {
    const s: OnboardingState = {
      welcome: { accepted_at: "x", timezone: "America/Sao_Paulo", display_name: "N" },
      whatsapp: { status: "WORKING" },
      routing: { mode: "manual" },
      funil: { pipeline_id: "f", origem: "ready_model", etapas: 6 },
      followup: { ativo: false },
      ai: { ai_mode: "copilot" },
      team: { invites_sent: 0, skipped: true },
    };
    expect(proximoPasso(s, SEM_LOJA)).toBeNull();
  });
});

describe("passo anterior", () => {
  it("o primeiro passo não tem para onde voltar", () => {
    expect(passoAnterior("welcome", SEM_LOJA)).toBeNull();
  });

  it("a ordem nova é negócio → WhatsApp → quem atende → organização", () => {
    expect(passoAnterior("connect-whatsapp", SEM_LOJA)?.segmento).toBe("welcome");
    expect(passoAnterior("quem-atende", SEM_LOJA)?.segmento).toBe("connect-whatsapp");
    expect(passoAnterior("funil", SEM_LOJA)?.segmento).toBe("quem-atende");
    expect(passoAnterior("follow-up", SEM_LOJA)?.segmento).toBe("funil");
    expect(passoAnterior("setup-ai", SEM_LOJA)?.segmento).toBe("follow-up");
    expect(passoAnterior("invite-team", SEM_LOJA)?.segmento).toBe("setup-ai");
  });

  it("na tela final volta para o último passo do wizard", () => {
    expect(passoAnterior("done", SEM_LOJA)?.segmento).toBe("invite-team");
  });
});

describe("resumo final", () => {
  it("NÃO lista o passo que a instalação nunca ofereceu", () => {
    const resumo = resumoDoOnboarding(VAZIO, SEM_LOJA);
    expect(resumo.map((i) => i.segmento)).not.toContain("connect-nuvemshop");
    expect(resumo.map((i) => i.segmento)).not.toContain("testar");
  });

  it("os rótulos não exigem jargão técnico", () => {
    const rotulos = resumoDoOnboarding(VAZIO, SEM_LOJA).map((i) => i.rotulo);
    expect(rotulos).toContain("WhatsApp");
    expect(rotulos).toContain("Quem atende");
    expect(rotulos).toContain("Organização");
    expect(rotulos).toContain("Inteligência artificial");
    expect(rotulos).not.toContain("Testar o agente");
  });
});
