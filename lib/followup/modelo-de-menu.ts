/**
 * Menu pronto para quem não sabe desenhar o quadro.
 * Cada opção vira um bloco já ligado: texto sai palavra por palavra (FAQ),
 * pessoa encerra o bot, assistente solta a IA. O "se não escolher" também
 * nasce ligado — senão o Publicar recusa o menu.
 */
import type { FlowEdge, FlowGraph, FlowNode } from "@/lib/followup/graph-schema";

export type DestinoDaOpcao = "texto" | "humano" | "assistente";

export type OpcaoDoModelo = {
  numero: number;
  rotulo: string;
  destino: DestinoDaOpcao;
  /** Frase enviada no texto ou ao chamar uma pessoa. Vazio no assistente. */
  texto: string;
};

const BASE: OpcaoDoModelo[] = [
  {
    numero: 1,
    rotulo: "Falar com alguém",
    destino: "humano",
    texto: "Certo. Vou te passar para uma pessoa da equipe.",
  },
  {
    numero: 2,
    rotulo: "Horário",
    destino: "texto",
    texto: "Atendemos de segunda a sexta, das 8h às 18h.",
  },
  {
    numero: 3,
    rotulo: "Tirar uma dúvida",
    destino: "assistente",
    texto: "",
  },
  {
    numero: 4,
    rotulo: "Opção 4",
    destino: "texto",
    texto: "Anotei a opção 4. Em instantes te respondo.",
  },
  {
    numero: 5,
    rotulo: "Opção 5",
    destino: "texto",
    texto: "Anotei a opção 5. Em instantes te respondo.",
  },
  {
    numero: 6,
    rotulo: "Opção 6",
    destino: "texto",
    texto: "Anotei a opção 6. Em instantes te respondo.",
  },
];

export function opcoesPadrao(quantidade: number): OpcaoDoModelo[] {
  const n = Math.min(6, Math.max(2, quantidade));
  return BASE.slice(0, n).map((o, i) => ({ ...o, numero: i + 1 }));
}

function corta(texto: string, max: number): string {
  const t = texto.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function chaves(numero: number, rotulo: string): string[] {
  const lista = [String(numero)];
  const palavra = corta(rotulo, 40);
  if (palavra && palavra !== String(numero)) lista.push(palavra);
  return lista;
}

export function montarModeloDeMenu(input: {
  titulo: string;
  opcoes: OpcaoDoModelo[];
  origem: { x: number; y: number };
  sufixo: string;
  incluirGatilho: boolean;
}): FlowGraph {
  const titulo = corta(input.titulo, 200) || "Como posso ajudar?";
  const opcoes = input.opcoes.map((o, i) => ({ ...o, numero: i + 1 }));
  const s = input.sufixo.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "menu";
  const x0 = input.origem.x;
  const y0 = input.origem.y;
  const menuId = `${s}-menu`;
  const fimId = `${s}-fim`;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  if (input.incluirGatilho) {
    const gatilhoId = `${s}-inicio`;
    nodes.push({
      id: gatilhoId,
      type: "trigger",
      label: "Primeira mensagem",
      position: { x: x0, y: y0 + 40 },
      config: {},
    });
    edges.push({
      id: `${s}-e-inicio`,
      source: gatilhoId,
      target: menuId,
      priority: 0,
      condition: { type: "always" },
    });
  }

  nodes.push({
    id: menuId,
    type: "menu",
    label: corta(titulo, 60),
    position: { x: x0 + (input.incluirGatilho ? 280 : 0), y: y0 },
    config: {
      title: titulo,
      retry_text: "Responda só com o número. Por exemplo: 1",
      options: opcoes.map((o) => ({
        id: `o${o.numero}`,
        number: o.numero,
        label: corta(o.rotulo, 80) || `Opção ${o.numero}`,
        keywords: chaves(o.numero, o.rotulo),
      })),
    },
  });

  const menuX = x0 + (input.incluirGatilho ? 280 : 0);
  let precisaFim = false;

  opcoes.forEach((o, i) => {
    const y = y0 + i * 170;
    const rotulo = corta(o.rotulo, 80) || `Opção ${o.numero}`;
    const alvoId = `${s}-o${o.numero}`;
    if (o.destino === "humano") {
      nodes.push({
        id: alvoId,
        type: "humano",
        label: corta(`Pessoa · ${rotulo}`, 60),
        position: { x: menuX + 340, y },
        config: {
          phrase: corta(o.texto, 500) || "Vou te passar para uma pessoa da equipe.",
        },
      });
    } else if (o.destino === "assistente") {
      nodes.push({
        id: alvoId,
        type: "assistente",
        label: corta(`Assistente · ${rotulo}`, 60),
        position: { x: menuX + 340, y },
        config: {},
      });
    } else {
      precisaFim = true;
      nodes.push({
        id: alvoId,
        type: "faq",
        label: corta(`Resposta · ${rotulo}`, 60),
        position: { x: menuX + 340, y },
        config: {
          items: [
            {
              id: `r${o.numero}`,
              keywords: chaves(o.numero, o.rotulo),
              answer: corta(o.texto, 1000) || `Anotei a opção ${o.numero}.`,
            },
          ],
        },
      });
      edges.push({
        id: `${s}-e-r${o.numero}`,
        source: alvoId,
        target: fimId,
        priority: 0,
        condition: { type: "branch", branch_id: `r${o.numero}` },
      });
      edges.push({
        id: `${s}-e-rf${o.numero}`,
        source: alvoId,
        target: fimId,
        priority: 1,
        condition: { type: "always" },
      });
    }
    edges.push({
      id: `${s}-e-o${o.numero}`,
      source: menuId,
      target: alvoId,
      priority: 0,
      condition: { type: "branch", branch_id: `o${o.numero}` },
    });
  });

  const senaoId = `${s}-senao`;
  nodes.push({
    id: senaoId,
    type: "humano",
    label: "Se não escolher",
    position: { x: menuX + 340, y: y0 + opcoes.length * 170 },
    config: {
      phrase: "Não entendi o número. Vou te passar para uma pessoa da equipe.",
    },
  });
  edges.push({
    id: `${s}-e-senao`,
    source: menuId,
    target: senaoId,
    priority: 1,
    condition: { type: "always" },
  });

  if (precisaFim) {
    nodes.push({
      id: fimId,
      type: "end",
      label: "Fim da resposta",
      position: { x: menuX + 680, y: y0 + 40 },
      config: { outcome: "custom", note: "Resposta do menu enviada" },
    });
  }

  return { nodes, edges };
}
