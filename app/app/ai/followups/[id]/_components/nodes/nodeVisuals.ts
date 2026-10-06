import type { ComponentType } from "react";

import {
  Play,
  Clock,
  GitBranch,
  Brain,
  PaperPlaneTilt,
  Flag,
  ChatCircle,
  Question,
  Handshake,
  Robot,
  PlugsConnected,
} from "@/lib/ui/icons";
import { ROTULO_DA_FONTE, type FlowNode, type NodeType } from "@/lib/followup/graph-schema";
import { RESULTADOS_DO_FIM } from "@/lib/followup/vocabulario";

/**
 * Visual identity per node type — shared by the palette (Task 6.2 increment 2)
 * and the custom node cards (increment 3). Each type gets a DISTINCT icon +
 * Sage token pairing (never a bare default React Flow box): trigger=accent
 * (start), wait=info (calm/waiting), condition=warning (branch), ai_classify=
 * solid accent (the "smart" step), action=success (send/go), end=error
 * (terminal — reads as "stop", not literally an error).
 */
export interface NodeVisual {
  type: NodeType;
  paletteLabel: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  /** Icon chip background + text. */
  chipClassName: string;
  /** Left accent border on the node card. */
  borderClassName: string;
  /** Fundo do cartão e do botão da paleta — uma cor por tipo. */
  washClassName: string;
  defaultLabel: string;
  defaultConfig: () => FlowNode["config"];
}

export const NODE_VISUALS: Record<NodeType, NodeVisual> = {
  trigger: {
    type: "trigger",
    paletteLabel: "Gatilho",
    icon: Play,
    chipClassName: "bg-emerald-600 text-white",
    borderClassName: "border-l-emerald-600",
    washClassName: "bg-emerald-50 dark:bg-emerald-950/40",
    defaultLabel: "Início do fluxo",
    defaultConfig: () => ({}),
  },
  wait: {
    type: "wait",
    paletteLabel: "Aguardar",
    icon: Clock,
    chipClassName: "bg-sky-600 text-white",
    borderClassName: "border-l-sky-600",
    washClassName: "bg-sky-50 dark:bg-sky-950/40",
    defaultLabel: "Aguardar",
    defaultConfig: () => ({ mode: "fixed", duration_ms: 300_000 }),
  },
  condition: {
    type: "condition",
    paletteLabel: "Condição",
    icon: GitBranch,
    chipClassName: "bg-amber-500 text-white",
    borderClassName: "border-l-amber-500",
    washClassName: "bg-amber-50 dark:bg-amber-950/40",
    defaultLabel: "Verificar condição",
    defaultConfig: () => ({
      combinator: "and",
      checks: [{ field: "steps_taken", op: "gte", value: 0 }],
    }),
  },
  ai_classify: {
    type: "ai_classify",
    paletteLabel: "Classificar (IA)",
    icon: Brain,
    chipClassName: "bg-fuchsia-600 text-white",
    borderClassName: "border-l-fuchsia-600",
    washClassName: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    defaultLabel: "Classificar resposta",
    defaultConfig: () => ({
      classes: ["hot", "cold"],
      grace_timeout_ms: 900_000,
      target: "last_reply",
    }),
  },
  action: {
    type: "action",
    paletteLabel: "Ação",
    icon: PaperPlaneTilt,
    chipClassName: "bg-teal-600 text-white",
    borderClassName: "border-l-teal-600",
    washClassName: "bg-teal-50 dark:bg-teal-950/40",
    defaultLabel: "Enviar mensagem",
    defaultConfig: () => ({ mode: "ai_message", prompt_hint: "Configure esta etapa." }),
  },
  end: {
    type: "end",
    paletteLabel: "Fim",
    icon: Flag,
    chipClassName: "bg-rose-600 text-white",
    borderClassName: "border-l-rose-600",
    washClassName: "bg-rose-50 dark:bg-rose-950/40",
    defaultLabel: "Fim do fluxo",
    defaultConfig: () => ({ outcome: "exhausted" }),
  },
  menu: {
    type: "menu",
    paletteLabel: "Menu",
    icon: ChatCircle,
    chipClassName: "bg-blue-600 text-white",
    borderClassName: "border-l-blue-600",
    washClassName: "bg-blue-50 dark:bg-blue-950/40",
    defaultLabel: "Menu",
    defaultConfig: () => ({
      title: "Como posso ajudar?",
      options: [
        { id: "opt_1", number: 1, label: "Atendimento", keywords: ["atendimento"] },
        { id: "opt_2", number: 2, label: "Comercial", keywords: ["comercial"] },
      ],
    }),
  },
  faq: {
    type: "faq",
    paletteLabel: "FAQ",
    icon: Question,
    chipClassName: "bg-cyan-600 text-white",
    borderClassName: "border-l-cyan-600",
    washClassName: "bg-cyan-50 dark:bg-cyan-950/40",
    defaultLabel: "Perguntas frequentes",
    defaultConfig: () => ({
      items: [{ id: "faq_1", keywords: ["horario", "funcionamento"], answer: "Nosso horário está no quadro Horário." }],
    }),
  },
  horario: {
    type: "horario",
    paletteLabel: "Horário",
    icon: Clock,
    chipClassName: "bg-orange-500 text-white",
    borderClassName: "border-l-orange-500",
    washClassName: "bg-orange-50 dark:bg-orange-950/40",
    defaultLabel: "Dentro ou fora do horário",
    defaultConfig: () => ({}),
  },
  humano: {
    type: "humano",
    paletteLabel: "Humano",
    icon: Handshake,
    chipClassName: "bg-green-600 text-white",
    borderClassName: "border-l-green-600",
    washClassName: "bg-green-50 dark:bg-green-950/40",
    defaultLabel: "Chamar pessoa",
    defaultConfig: () => ({ phrase: "Vou te passar para alguém da equipe." }),
  },
  assistente: {
    type: "assistente",
    paletteLabel: "Assistente",
    icon: Robot,
    chipClassName: "bg-violet-600 text-white",
    borderClassName: "border-l-violet-600",
    washClassName: "bg-violet-50 dark:bg-violet-950/40",
    defaultLabel: "Chamar assistente",
    defaultConfig: () => ({}),
  },
  consulta: {
    type: "consulta",
    paletteLabel: "Consultar gestão",
    icon: PlugsConnected,
    chipClassName: "bg-indigo-600 text-white",
    borderClassName: "border-l-indigo-600",
    washClassName: "bg-indigo-50 dark:bg-indigo-950/40",
    defaultLabel: "Consultar gestão",
    defaultConfig: () => ({ fonte: "oferta" }),
  },
};

export const NODE_VISUAL_LIST = Object.values(NODE_VISUALS);

type ConfigOf<T extends NodeType> = Extract<FlowNode, { type: T }>["config"];

/**
 * One-line summary of a node's config — shown as the card subtitle. Takes the
 * RF node's own `type`/`data.config` pair (not a reconstructed `FlowNode`)
 * because the node components only ever see React Flow's generic shape.
 */
export function describeNodeConfig(type: NodeType, config: FlowNode["config"]): string {
  switch (type) {
    case "trigger":
      return "Início do fluxo";
    case "wait": {
      const c = config as ConfigOf<"wait">;
      return c.mode === "fixed"
        ? `${Math.round(c.duration_ms / 60_000)} min`
        : `${Math.round(c.min_ms / 60_000)}–${Math.round(c.max_ms / 60_000)} min (adaptativo)`;
    }
    case "condition": {
      const c = config as ConfigOf<"condition">;
      // No modo uma-saída-por-regra o combinador NÃO é consultado (a regra não
      // vota, ela roteia). Continuar anunciando "E"/"OU" ali seria o card
      // afirmando uma coisa que o motor ignora — e o usuário acredita no card.
      if (c.branching === "per_check") return `${c.checks.length} regras · uma saída por regra`;
      return `${c.checks.length} condição(ões) · ${c.combinator === "and" ? "E" : "OU"}`;
    }
    case "ai_classify": {
      const c = config as ConfigOf<"ai_classify">;
      return `${c.classes.length} classes · grace ${Math.round(c.grace_timeout_ms / 60_000)}min`;
    }
    case "action": {
      const c = config as ConfigOf<"action">;
      return c.mode === "ai_message" ? c.prompt_hint : "Template fixo";
    }
    case "end": {
      const c = config as ConfigOf<"end">;
      return RESULTADOS_DO_FIM[c.outcome];
    }
    case "menu": {
      const c = config as ConfigOf<"menu">;
      return `${c.options.length} opções`;
    }
    case "faq": {
      const c = config as ConfigOf<"faq">;
      return `${c.items.length} respostas`;
    }
    case "horario":
      return "Janela do assistente";
    case "humano": {
      const c = config as ConfigOf<"humano">;
      return c.phrase?.trim() ? "Com recado" : "Sem recado";
    }
    case "assistente": {
      const c = config as ConfigOf<"assistente">;
      return c.agent_id ? "Assistente escolhido" : "Escolha qual assistente";
    }
    case "consulta": {
      const c = config as ConfigOf<"consulta">;
      return ROTULO_DA_FONTE[c.fonte];
    }
    default: {
      const exhaustive: never = type;
      return String(exhaustive);
    }
  }
}
