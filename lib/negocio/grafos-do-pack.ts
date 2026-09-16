import type { PackFollowupSeed } from "@/lib/business-packs/tipos";
import type { FlowGraph } from "@/lib/followup/graph-schema";

const ESPERA_MIN_MS = 300_000;

export function minutosParaMs(minutos: number): number {
  return Math.max(ESPERA_MIN_MS, Math.round(minutos) * 60_000);
}

export type TemplatesDoGrafo = {
  primeira: string;
  segunda?: string;
};

export function grafoDoFluxoPronto(
  seed: PackFollowupSeed,
  templates: string | TemplatesDoGrafo,
  etapaId?: string | null,
): FlowGraph {
  const primeira = typeof templates === "string" ? templates : templates.primeira;
  const segunda = typeof templates === "string" ? undefined : templates.segunda;
  const modelo =
    Boolean(seed.com_condicao && seed.message_2 && segunda && etapaId) &&
    seed.kind === "stage_change" &&
    (seed.wait_minutes ?? 0) >= 5;

  if (modelo && etapaId && segunda) {
    const espera2 = Math.max(5, seed.wait2_minutes ?? 480);
    return {
      nodes: [
        { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
        {
          id: "w1",
          type: "wait",
          label: "Espera 1",
          position: { x: 180, y: 0 },
          config: { mode: "fixed", duration_ms: minutosParaMs(seed.wait_minutes ?? 120) },
        },
        {
          id: "c1",
          type: "condition",
          label: "Ainda na etapa",
          position: { x: 360, y: 0 },
          config: {
            combinator: "and",
            branching: "combined",
            checks: [
              {
                field: "lead_stage",
                op: "eq",
                value: etapaId,
                label: "Ainda nesta etapa",
              },
            ],
          },
        },
        {
          id: "a1",
          type: "action",
          label: "1º recado",
          position: { x: 560, y: -80 },
          config: { mode: "template", template_id: primeira },
        },
        {
          id: "w2",
          type: "wait",
          label: "Espera 2",
          position: { x: 760, y: -80 },
          config: { mode: "fixed", duration_ms: minutosParaMs(espera2) },
        },
        {
          id: "c2",
          type: "condition",
          label: "Ainda sem resposta",
          position: { x: 960, y: -80 },
          config: {
            combinator: "and",
            branching: "combined",
            checks: [
              {
                field: "lead_stage",
                op: "eq",
                value: etapaId,
                label: "Ainda nesta etapa",
              },
            ],
          },
        },
        {
          id: "a2",
          type: "action",
          label: "2º recado",
          position: { x: 1160, y: -80 },
          config: { mode: "template", template_id: segunda },
        },
        {
          id: "e-ok",
          type: "end",
          label: "Enviou",
          position: { x: 1360, y: -80 },
          config: { outcome: "converted" },
        },
        {
          id: "e-saiu",
          type: "end",
          label: "Saiu da etapa",
          position: { x: 560, y: 120 },
          config: { outcome: "exhausted" },
        },
      ],
      edges: [
        { id: "t1-w1", source: "t1", target: "w1", priority: 0, condition: { type: "always" } },
        { id: "w1-c1", source: "w1", target: "c1", priority: 0, condition: { type: "always" } },
        { id: "c1-a1", source: "c1", target: "a1", priority: 0, condition: { type: "cond_result", value: true } },
        { id: "c1-out", source: "c1", target: "e-saiu", priority: 1, condition: { type: "cond_result", value: false } },
        { id: "c1-else", source: "c1", target: "e-saiu", priority: 2, condition: { type: "always" } },
        { id: "a1-w2", source: "a1", target: "w2", priority: 0, condition: { type: "always" } },
        { id: "w2-c2", source: "w2", target: "c2", priority: 0, condition: { type: "always" } },
        { id: "c2-a2", source: "c2", target: "a2", priority: 0, condition: { type: "cond_result", value: true } },
        { id: "c2-out", source: "c2", target: "e-saiu", priority: 1, condition: { type: "cond_result", value: false } },
        { id: "c2-else", source: "c2", target: "e-saiu", priority: 2, condition: { type: "always" } },
        { id: "a2-ok", source: "a2", target: "e-ok", priority: 0, condition: { type: "always" } },
      ],
    };
  }

  const espera = seed.kind === "stage_change" && (seed.wait_minutes ?? 0) >= 5;
  if (!espera) {
    return {
      nodes: [
        { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
        {
          id: "a1",
          type: "action",
          label: "Mensagem",
          position: { x: 220, y: 0 },
          config: { mode: "template", template_id: primeira },
        },
        { id: "e1", type: "end", label: "Fim", position: { x: 440, y: 0 }, config: { outcome: "converted" } },
      ],
      edges: [
        { id: "t1-a1", source: "t1", target: "a1", priority: 0, condition: { type: "always" } },
        { id: "a1-e1", source: "a1", target: "e1", priority: 0, condition: { type: "always" } },
      ],
    };
  }
  return {
    nodes: [
      { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
      {
        id: "w1",
        type: "wait",
        label: "Espera",
        position: { x: 180, y: 0 },
        config: { mode: "fixed", duration_ms: minutosParaMs(seed.wait_minutes ?? 5) },
      },
      {
        id: "a1",
        type: "action",
        label: "Mensagem",
        position: { x: 360, y: 0 },
        config: { mode: "template", template_id: primeira },
      },
      { id: "e1", type: "end", label: "Fim", position: { x: 540, y: 0 }, config: { outcome: "converted" } },
    ],
    edges: [
      { id: "t1-w1", source: "t1", target: "w1", priority: 0, condition: { type: "always" } },
      { id: "w1-a1", source: "w1", target: "a1", priority: 0, condition: { type: "always" } },
      { id: "a1-e1", source: "a1", target: "e1", priority: 0, condition: { type: "always" } },
    ],
  };
}

export function quandoDoFluxo(seed: PackFollowupSeed): string {
  if (seed.kind === "silence") {
    const h = Math.max(1, Math.round((seed.threshold_minutes ?? 120) / 60));
    return h === 1 ? "Se ninguém responder em 1 hora" : `Se ninguém responder em ${h} horas`;
  }
  const etapa = seed.stage_name?.trim() || "essa etapa";
  const espera = seed.wait_minutes ?? 0;
  if (seed.com_condicao && seed.message_2) {
    const h1 = Math.max(1, Math.round((seed.wait_minutes ?? 120) / 60));
    const h2 = Math.max(1, Math.round((seed.wait2_minutes ?? 480) / 60));
    return `Quando o card entra em “${etapa}”, espera ${h1}h, confere se ainda está lá, manda; espera ${h2}h e confere de novo`;
  }
  if (espera >= 60) {
    const h = Math.round(espera / 60);
    return `Quando o card entra em “${etapa}”, espera ${h} ${h === 1 ? "hora" : "horas"}`;
  }
  if (espera >= 5) {
    return `Quando o card entra em “${etapa}”, espera ${espera} minutos`;
  }
  return `Quando o card entra em “${etapa}”`;
}
