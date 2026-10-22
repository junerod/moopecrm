import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";
import {
  DIAS_MAXIMOS_DA_AGENDA,
  donoDaLeitura,
  ehGestorDaLeitura,
  idExternoDoContato,
  janelaPadraoDaAgenda,
  montarFunil,
  papelDaLeitura,
  projetarPulso,
  validarJanela,
} from "@/lib/moope/leitura";
import type { KpisDeSupervisao } from "@/lib/supervisao/kpis";

const ISO = "2026-10-22T03:00:00.000Z";

function kpisComAtendente(): KpisDeSupervisao {
  return {
    atendimento: {
      fila: 3,
      espera_mais_antiga_s: 120,
      primeira_resposta_media_s: 40,
      conversas_abertas: 8,
      conversas_por_atendente: [{ user_id: "user-secreto", abertas: 2 }],
    },
    comercial: {
      leads_novos: 4,
      oportunidades_abertas: 6,
      sem_proxima_acao: 1,
      atrasadas: 2,
      ganhos: 1,
      perdidos: 1,
      conversao: 0.5,
    },
    funil: [
      {
        stage_id: "st-1",
        stage_name: "Em andamento",
        pipeline_id: "pipe-1",
        count: 2,
        value_cents: 1000,
      },
    ],
    campanhas: {
      executadas: 1,
      enviados: 10,
      respostas: 3,
      leads_associados: 4,
      opt_outs: 1,
      ganhos: 0,
      perdidos: 0,
      valor_ganho_cents: 0,
    },
    origem: [],
    conteudos: [],
    perdas: [{ motivo: "preço", quantidade: 1, valor_cents: 500 }],
    atendentes: [
      {
        user_id: "user-secreto",
        conversas: 2,
        primeira_resposta_s: 40,
        resolvidas: 1,
        leads: 1,
        ganhos: 0,
        atrasadas: 0,
      },
    ],
  };
}

describe("leitura MOOPE", () => {
  it("agente vê o seu; gestor vê o escritório", () => {
    expect(donoDaLeitura({ gestor: false, userId: "u1" })).toBe("u1");
    expect(donoDaLeitura({ gestor: true, userId: "u1" })).toBeNull();
    expect(ehGestorDaLeitura("manager")).toBe(true);
    expect(ehGestorDaLeitura("admin")).toBe(true);
    expect(ehGestorDaLeitura("agent")).toBe(false);
    expect(papelDaLeitura("ai_operator")).toBeNull();
    expect(papelDaLeitura("agent")).toBe("agent");
  });

  it("reconhece o id que o parceiro mandou e ignora o resto do metadado", () => {
    expect(idExternoDoContato({ moope_external_id: "cli-9", phone: "+5511" })).toBe("cli-9");
    expect(idExternoDoContato({ phone: "+5511" })).toBeNull();
    expect(idExternoDoContato(null)).toBeNull();
  });

  it("recusa período maior que 62 dias e fim antes do começo", () => {
    const de = "2026-10-01T00:00:00.000Z";
    const ateOk = "2026-10-20T00:00:00.000Z";
    const ateLongo = new Date(Date.parse(de) + (DIAS_MAXIMOS_DA_AGENDA + 1) * 86_400_000).toISOString();
    expect(validarJanela(de, ateOk).ok).toBe(true);
    expect(validarJanela(de, ateLongo).ok).toBe(false);
    expect(validarJanela(ateOk, de).ok).toBe(false);
  });

  it("sem recorte, a janela padrão cobre hoje e amanhã", () => {
    const j = janelaPadraoDaAgenda(new Date(ISO));
    const ms = Date.parse(j.ate) - Date.parse(j.de);
    expect(ms).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("funil conta abertos por etapa e não trata ganho como coluna aberta", () => {
    const funil = montarFunil(
      [{ id: "p", name: "Processos", position: 1 }],
      [
        { id: "s1", name: "Novo", pipeline_id: "p", position: 1, is_won: false, is_lost: false },
        { id: "s2", name: "Encerrado", pipeline_id: "p", position: 9, is_won: true, is_lost: false },
      ],
      [
        { stage_id: "s1", pipeline_id: "p", value_cents: 100 },
        { stage_id: "s1", pipeline_id: "p", value_cents: 50 },
      ],
      [{ pipeline_id: "p", won: 4, lost: 2 }],
      false,
    );
    expect(funil.pipelines[0]).toMatchObject({
      name: "Processos",
      open: 2,
      won: 4,
      lost: 2,
      value_open_cents: 150,
    });
    expect(funil.pipelines[0]?.stages.map((s) => s.name)).toEqual(["Novo"]);
    expect(funil.pipelines[0]?.stages[0]?.count).toBe(2);
  });

  it("pulso não leva id de usuário nem a lista de atendentes", () => {
    const pulso = projetarPulso("7d", kpisComAtendente(), new Map([["pipe-1", "Processos"]]));
    const cru = JSON.stringify(pulso);
    expect(cru).not.toContain("user-secreto");
    expect(cru).not.toContain("user_id");
    expect(pulso.queue).toBe(3);
    expect(pulso.funnel[0]).toEqual({
      stage_name: "Em andamento",
      pipeline_name: "Processos",
      count: 2,
      value_cents: 1000,
    });
    expect(pulso.campaigns_in_period).toEqual({
      sent: 10,
      replies: 3,
      opt_outs: 1,
      won: 0,
      lost: 0,
    });
    expect(pulso.losses).toEqual([{ reason: "preço", count: 1, value_cents: 500 }]);
  });

  it("as cinco leituras passam sem cookie; o cadastro da chave não", () => {
    for (const caminho of [
      "/api/v1/integrations/moope/agenda",
      "/api/v1/integrations/moope/acoes",
      "/api/v1/integrations/moope/pulso",
      "/api/v1/integrations/moope/leads",
      "/api/v1/integrations/moope/funil",
    ]) {
      expect(isPublicPath(caminho)).toBe(true);
    }
    expect(isPublicPath("/api/v1/integrations/moope")).toBe(false);
    expect(isPublicPath("/api/v1/integrations/moope/agenda/extra")).toBe(false);
  });
});
