import type { TomDs } from "@/lib/design-system/tones";
import {
  BookOpen,
  Buildings,
  Car,
  ChatCircle,
  FlowArrow,
  Funnel,
  Handshake,
  Headset,
  Kanban,
  Lightning,
  Megaphone,
  PlugsConnected,
  Question,
  Robot,
  Scales,
  Storefront,
  Warning,
} from "@/lib/ui/icons";
import { CAPITULOS } from "@/lib/manual/conteudo";

type Icone = typeof BookOpen;

export type VisualDoCapitulo = {
  icone: Icone;
  tom: TomDs;
  grupo: string;
};

const VISUAL: Record<string, VisualDoCapitulo> = {
  "primeiro-acesso": { icone: Lightning, tom: "amber", grupo: "Começar" },
  "modelos-prontos": { icone: Storefront, tom: "blue", grupo: "Começar" },
  whatsapp: { icone: PlugsConnected, tom: "teal", grupo: "Começar" },
  mensagens: { icone: ChatCircle, tom: "indigo", grupo: "Operação" },
  "contatos-e-funis": { icone: Kanban, tom: "amber", grupo: "Operação" },
  agente: { icone: Robot, tom: "violet", grupo: "Operação" },
  conhecimento: { icone: BookOpen, tom: "cyan", grupo: "Operação" },
  "follow-up": { icone: FlowArrow, tom: "cyan", grupo: "Operação" },
  campanhas: { icone: Megaphone, tom: "violet", grupo: "Operação" },
  locadora: { icone: Car, tom: "teal", grupo: "Modelos" },
  advocacia: { icone: Scales, tom: "indigo", grupo: "Modelos" },
  "outros-modelos": { icone: Handshake, tom: "green", grupo: "Modelos" },
  rotina: { icone: Funnel, tom: "blue", grupo: "Dia a dia" },
  moope: { icone: Headset, tom: "blue", grupo: "Dia a dia" },
  plataforma: { icone: Buildings, tom: "amber", grupo: "Dia a dia" },
  "nao-funciona": { icone: Warning, tom: "red", grupo: "Se travou" },
};

export const GRUPOS_DO_MANUAL = ["Começar", "Operação", "Modelos", "Dia a dia", "Se travou"] as const;

export function visualDoCapitulo(id: string): VisualDoCapitulo {
  return VISUAL[id] ?? { icone: Question, tom: "amber", grupo: "Dia a dia" };
}

export function capitulosPorGrupo() {
  return GRUPOS_DO_MANUAL.map((grupo) => ({
    grupo,
    capitulos: CAPITULOS.filter((c) => visualDoCapitulo(c.id).grupo === grupo),
  })).filter((g) => g.capitulos.length > 0);
}
