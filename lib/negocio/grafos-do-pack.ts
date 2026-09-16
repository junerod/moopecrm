import type { PackFollowupSeed } from "@/lib/business-packs/tipos";
import type { FlowGraph } from "@/lib/followup/graph-schema";

const ESPERA_MIN_MS = 300_000;

export function minutosParaMs(minutos: number): number {
  return Math.max(ESPERA_MIN_MS, Math.round(minutos) * 60_000);
}

export function grafoDoFluxoPronto(seed: PackFollowupSeed, templateId: string): FlowGraph {
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
          config: { mode: "template", template_id: templateId },
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
        config: { mode: "template", template_id: templateId },
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
  if (espera >= 60) {
    const h = Math.round(espera / 60);
    return `Quando o card entra em “${etapa}”, espera ${h} ${h === 1 ? "hora" : "horas"}`;
  }
  if (espera >= 5) {
    return `Quando o card entra em “${etapa}”, espera ${espera} minutos`;
  }
  return `Quando o card entra em “${etapa}”`;
}
