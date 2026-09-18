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
  /** Só a equipe lê. Vale quando o destino é uma pessoa. */
  comentario?: string;
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
          ...(corta(o.comentario ?? "", 500)
            ? { team_note: corta(o.comentario ?? "", 500) }
            : {}),
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

export const ID_DE_MODELO_PRONTO = ["escritorio", "locadora", "loja", "aviso"] as const;
export type IdDeModeloPronto = (typeof ID_DE_MODELO_PRONTO)[number];

export const MODELOS_PRONTOS: {
  id: IdDeModeloPronto;
  nome: string;
  explica: string;
  classe: string;
}[] = [
  {
    id: "escritorio",
    nome: "Jurídico",
    explica: "Advogado, horário, agendar, dúvida e outro WhatsApp. A equipe vê o comentário. A conversa não muda de número.",
    classe: "border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "locadora",
    nome: "Locadora",
    explica: "Locatário, investidor, carro, boleto, socorro e outro WhatsApp. Cada um chama uma pessoa e deixa o pedido no comentário.",
    classe: "border-orange-500/40 bg-orange-500/10",
  },
  {
    id: "loja",
    nome: "Loja",
    explica: "Vendas, horário, uma dúvida e outro assunto. Já vem com o texto para você só ajustar.",
    classe: "border-sky-500/40 bg-sky-500/10",
  },
  {
    id: "aviso",
    nome: "Só avisar a equipe",
    explica: "Sem menu. O cliente ouve um recado e a equipe lê um comentário na Central.",
    classe: "border-emerald-500/40 bg-emerald-500/10",
  },
];

function opcaoOutroWhatsapp(numero: number): OpcaoDoModelo {
  return {
    numero,
    rotulo: "Outro WhatsApp",
    destino: "humano",
    texto: "Para continuar, escreva no outro WhatsApp. Coloque o número aqui antes de publicar.",
    comentario:
      "Cliente pediu o outro número. A conversa não muda de WhatsApp. O resumo é esta conversa: leia e responda no número certo.",
  };
}

function opcoesDoEscritorio(): OpcaoDoModelo[] {
  return [
    {
      numero: 1,
      rotulo: "Falar com o advogado",
      destino: "humano",
      texto: "Certo. Vou chamar alguém do escritório.",
      comentario: "Cliente pediu para falar com o advogado.",
    },
    {
      numero: 2,
      rotulo: "Horário",
      destino: "texto",
      texto: "Atendemos em horário comercial, de segunda a sexta. Se for urgente, escolha falar com o advogado.",
    },
    {
      numero: 3,
      rotulo: "Agendar",
      destino: "humano",
      texto: "Vou te passar para quem confirma o dia e a hora.",
      comentario: "Cliente quer marcar um horário. Confirme dia e hora com ele.",
    },
    {
      numero: 4,
      rotulo: "Tirar uma dúvida",
      destino: "humano",
      texto: "Vou te passar para alguém do escritório.",
      comentario: "Cliente tem uma dúvida. Responda nesta conversa.",
    },
    opcaoOutroWhatsapp(5),
  ];
}

function opcoesDaLocadora(): OpcaoDoModelo[] {
  return [
    {
      numero: 1,
      rotulo: "Sou locatário",
      destino: "humano",
      texto: "Vou chamar quem cuida do seu contrato.",
      comentario: "Disse que é locatário. Confira no Moope pelo telefone desta conversa: contrato, placa, boleto.",
    },
    {
      numero: 2,
      rotulo: "Sou investidor",
      destino: "humano",
      texto: "Vou chamar quem cuida dos investidores.",
      comentario: "Disse que é investidor. Confira no Moope pelo telefone. O resumo é esta conversa.",
    },
    {
      numero: 3,
      rotulo: "Quero um carro",
      destino: "humano",
      texto: "Vou chamar quem mostra os carros disponíveis.",
      comentario: "Quer um carro. Veja a frota no Moope e responda nesta conversa. Não invente preço.",
    },
    {
      numero: 4,
      rotulo: "Boleto ou contrato",
      destino: "humano",
      texto: "Vou chamar quem envia o boleto ou o contrato.",
      comentario: "Pediu boleto ou contrato. Busque no Moope e responda nesta conversa. Sem link, não invente.",
    },
    {
      numero: 5,
      rotulo: "Socorro",
      destino: "humano",
      texto: "Vou chamar alguém da equipe agora.",
      comentario: "Socorro. Atenda nesta conversa, no número em que a pessoa escreveu.",
    },
    {
      numero: 6,
      rotulo: "Falar com a equipe",
      destino: "humano",
      texto: "Vou te passar para uma pessoa da locadora.",
      comentario: "Cliente pediu a equipe.",
    },
    opcaoOutroWhatsapp(7),
  ];
}

function opcoesDaLoja(): OpcaoDoModelo[] {
  return [
    {
      numero: 1,
      rotulo: "Falar com vendas",
      destino: "humano",
      texto: "Vou te passar para alguém de vendas.",
      comentario: "Cliente quer falar com vendas.",
    },
    {
      numero: 2,
      rotulo: "Horário",
      destino: "texto",
      texto: "Atendemos de segunda a sexta, das 8h às 18h, e sábado das 8h às 12h.",
    },
    {
      numero: 3,
      rotulo: "Tirar uma dúvida",
      destino: "humano",
      texto: "Vou te passar para alguém da loja.",
      comentario: "Cliente tem uma dúvida. Responda nesta conversa.",
    },
    {
      numero: 4,
      rotulo: "Outro assunto",
      destino: "humano",
      texto: "Vou te passar para uma pessoa da equipe.",
      comentario: "Cliente escolheu outro assunto.",
    },
    opcaoOutroWhatsapp(5),
  ];
}

export function montarModeloPronto(
  id: IdDeModeloPronto,
  entrada: { origem: { x: number; y: number }; sufixo: string; incluirGatilho: boolean },
): FlowGraph {
  if (id === "aviso") return montarAviso(entrada);
  const titulo =
    id === "locadora"
      ? "Olá. Você é locatário, investidor ou quer um carro?"
      : id === "escritorio"
        ? "Como posso ajudar?"
        : "Olá, como posso ajudar?";
  const opcoes =
    id === "locadora" ? opcoesDaLocadora() : id === "escritorio" ? opcoesDoEscritorio() : opcoesDaLoja();
  return montarModeloDeMenu({ titulo, opcoes, ...entrada });
}

function montarAviso(entrada: {
  origem: { x: number; y: number };
  sufixo: string;
  incluirGatilho: boolean;
}): FlowGraph {
  const s = entrada.sufixo.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "aviso";
  const humanoId = `${s}-pessoa`;
  const nodes: FlowNode[] = [
    {
      id: humanoId,
      type: "humano",
      label: "Avisar a equipe",
      position: { x: entrada.origem.x + (entrada.incluirGatilho ? 280 : 0), y: entrada.origem.y },
      config: {
        phrase: "Vou te passar para uma pessoa da equipe.",
        team_note: "O bot avisou a equipe. Leia a conversa e responda.",
      },
    },
  ];
  const edges: FlowEdge[] = [];
  if (entrada.incluirGatilho) {
    const gatilhoId = `${s}-inicio`;
    nodes.unshift({
      id: gatilhoId,
      type: "trigger",
      label: "Primeira mensagem",
      position: { x: entrada.origem.x, y: entrada.origem.y + 40 },
      config: {},
    });
    edges.push({
      id: `${s}-e-inicio`,
      source: gatilhoId,
      target: humanoId,
      priority: 0,
      condition: { type: "always" },
    });
  }
  return { nodes, edges };
}
