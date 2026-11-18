/**
 * O que a tela Integração MOOPE explica.
 *
 * Cada exemplo aponta para um controle que existe. Fonte do bot, ferramenta
 * do assistente e destino do menu saem dos módulos que o produto já usa —
 * a aba não inventa consulta.
 */
import {
  FERRAMENTAS_EXEMPLO_LOCADORA,
  FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA,
} from "@/lib/moope/exemplo-assistente-locadora";
import { FONTES_DE_CONSULTA, ROTULO_DA_FONTE, type FonteDeConsulta } from "@/lib/followup/graph-schema";
import { TOOLS_LOCADORA } from "@/lib/mcp/tools/catalogo/locadora";

export const ABA_COMO_USAR = "como-usar";

export interface PassoDaTela {
  menu: string;
  href: string;
  tituloDaJanela: string;
  oQueClicar: string;
}

export interface ExemploDePergunta {
  id: string;
  fonte: FonteDeConsulta | null;
  ferramenta: string | null;
  /** Outra chamada da mesma resposta, quando a primeira só identifica. */
  acompanha?: readonly string[];
  titulo: string;
  pergunta: string;
  resposta: string;
  tom: "emerald" | "sky" | "amber" | "violet" | "orange" | "teal";
  passo: PassoDaTela;
  limite: string;
}

const PASSO_BOT: PassoDaTela = {
  menu: "Automação & IA → Bots → quadro → Consultar gestão",
  href: "/app/ai/followups",
  tituloDaJanela: "Bots · bloco Consultar gestão",
  oQueClicar: "Marque uma fonte. Ligue o ramo «Não encontrou» a um bloco Humano.",
};

export const PASSO_ASSISTENTE: PassoDaTela = {
  menu: "Automação & IA → Assistentes IA → Conversa com o cliente → 4. O que faz",
  href: "/app/ai/agents",
  tituloDaJanela: "Assistente · O que faz",
  oQueClicar: "A ferramenta precisa estar ligada neste passo. Depois publique.",
};

export const PORTA_BOT = {
  id: "bot",
  titulo: "Pelo bot",
  href: "/app/ai/followups",
  menu: "Automação & IA → Bots",
  resumo:
    "O quadro manda um texto pronto. O cliente escolhe no menu, ou cai no bloco Consultar gestão. A frase que sai é só o que a gestão devolveu. Este caminho não gasta chave de IA.",
} as const;

export const PORTA_ASSISTENTE = {
  id: "assistente",
  titulo: "Pelo assistente de IA",
  href: "/app/ai/agents",
  menu: "Automação & IA → Assistentes IA",
  resumo:
    "O cliente pergunta do jeito dele. O assistente chama a gestão e fala só o que voltou. Na entrada ele lê o menu que a locadora editou. Para pensar, ele usa a chave que a sua empresa cola em Credenciais — não a chave da instalação.",
} as const;

export const PASSO_CREDENCIAL: PassoDaTela = {
  menu: "Automação & IA → Credenciais",
  href: "/app/ai/credentials",
  tituloDaJanela: "Credenciais · chave da inteligência",
  oQueClicar: "Cole a API key da sua empresa (Anthropic, OpenAI ou Google) e salve. Sem uma chave validada, o assistente da locadora fica em rascunho — ele não entra no ar com a chave da instalação.",
};

export const PASSO_HUMANO: PassoDaTela = {
  menu: "Automação & IA → Bots → bloco Humano",
  href: "/app/ai/followups",
  tituloDaJanela: "Bots · Quem recebe a conversa",
  oQueClicar: "Escolha a pessoa da equipe. Vazio manda para a Central, e a fila distribui.",
};

export const PASSO_FILA: PassoDaTela = {
  menu: "Organização → Distribuição de atendimento",
  href: "/app/settings/atendimento",
  tituloDaJanela: "Distribuição de atendimento",
  oQueClicar: "Manual: alguém puxa. Rodízio: quem está disponível, no horário e com vaga.",
};

export const PASSO_CONEXAO: PassoDaTela = {
  menu: "Integrações → Integração MOOPE → aba Conexão",
  href: "/app/integrations/moope",
  tituloDaJanela: "Integração MOOPE · Conexão",
  oQueClicar:
    "Não cole endereço aqui. Na locadora, aba Atendimento, clique Ligar agora. Esta tela só mostra de onde o atendimento passou a ler.",
};

/** O que o cliente pode ouvir hoje, no bot e no assistente de exemplo. */
export const EXEMPLOS_DE_PERGUNTA: readonly ExemploDePergunta[] = [
  {
    id: "oferta",
    fonte: "oferta",
    ferramenta: "moope_listar_oferta",
    titulo: "Quais carros estão disponíveis",
    pergunta: "Quais carros vocês têm disponível?",
    resposta:
      "Veículos na gestão:\n• Onix — disponível — R$ 210,00/dia\n• Compass — alugado — R$ 3.200,00/mês",
    tom: "emerald",
    passo: PASSO_BOT,
    limite:
      "Sai o que a página de ofertas da gestão mandar: modelo, situação e preço, se o preço vier. O bot lista até 8. Sem preço no retorno, ninguém inventa valor. Não filtra por lugares nem por data.",
  },
  {
    id: "cliente",
    fonte: "cliente",
    ferramenta: "moope_lookup_locatario",
    titulo: "Este telefone já é cliente",
    pergunta: "Oi, já alugo com vocês.",
    resposta: "Encontrei o cadastro de Ana Lima.\nContrato: ativo.",
    tom: "sky",
    passo: PASSO_BOT,
    limite: "A busca é pelo telefone desta conversa. Nome sozinho não identifica. Se não achar, o quadro segue por «Não encontrou».",
  },
  {
    id: "situacao",
    fonte: "situacao",
    ferramenta: "moope_get_retrato",
    titulo: "Qual é o meu carro e o contrato",
    pergunta: "Qual carro está no meu nome?",
    resposta: "Ana Lima\nOnix · ABC1D23\nContrato mensal\nContrato: ativo.",
    tom: "violet",
    passo: PASSO_BOT,
    limite: "Placa, modelo, contrato e boleto só entram se o retrato da gestão trouxer. Sem o campo, a frase não nasce.",
  },
  {
    id: "financeiro",
    fonte: "financeiro",
    ferramenta: "moope_consultar_financeiro",
    titulo: "Parcelas e atraso",
    pergunta: "Estou devendo alguma parcela?",
    resposta: "Financeiro:\n• 2026-11-10 — R$ 1.890,00 — em aberto",
    tom: "amber",
    passo: PASSO_BOT,
    limite: "Lista parcelas que a gestão devolver. Não dá baixa e não cria cobrança.",
  },
  {
    id: "boleto",
    fonte: "boleto",
    ferramenta: "moope_obter_segunda_via",
    titulo: "Segunda via do boleto ou PIX",
    pergunta: "Me manda o boleto.",
    resposta: "Segunda via do boleto: https://cobranca.exemplo/boleto/abc",
    tom: "orange",
    passo: PASSO_BOT,
    limite: "Só link https que a gestão já gerou. Sem link, o bloco vai para «Não encontrou» e uma pessoa assume.",
  },
  {
    id: "investidor",
    fonte: "investidor",
    ferramenta: "moope_lookup_investidor",
    acompanha: ["moope_get_retrato_investidor"],
    titulo: "Este telefone é investidor",
    pergunta: "Quero ver meu portal.",
    resposta: "Encontrei o investidor Carlos Nunes.\nÚltimo período: 2026-10.\nPortal: https://portal.exemplo/i/9",
    tom: "teal",
    passo: PASSO_BOT,
    limite: "Nome, último período e o link do portal. Não envia PDF nem rendimento que a gestão não mandou.",
  },
];

export const EXEMPLO_DE_PESSOA = {
  titulo: "Passar para uma pessoa",
  pergunta: "Quero falar com alguém.",
  resposta: "Vou te passar para uma pessoa da equipe.",
  limite:
    "No bot, o bloco Humano entrega a conversa para o membro que você escolheu. No assistente, o pedido cai no rodízio de quem está disponível; se ninguém estiver, fica na fila. O cliente continua neste WhatsApp. Ninguém disca para o celular do atendente.",
} as const;

/** Consultas que o exemplo liga no painel do atendente, e o cliente não ouve sozinho. */
export function ferramentasSoDoAtendente(): readonly string[] {
  const doCliente = new Set<string>(FERRAMENTAS_EXEMPLO_LOCADORA);
  return FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA.filter((id) => !doCliente.has(id));
}

export function rotuloDaFerramenta(nome: string): string {
  return TOOLS_LOCADORA.find((t) => t.name === nome)?.rotulo ?? nome;
}

export function explicacaoDaFerramenta(nome: string): string {
  return TOOLS_LOCADORA.find((t) => t.name === nome)?.explicacao ?? "";
}

/** Catálogo que existe e não está nem na fala com o cliente nem no operador do exemplo. */
export function ferramentasForaDoExemplo(): readonly string[] {
  const ligadas = new Set<string>([
    ...FERRAMENTAS_EXEMPLO_LOCADORA,
    ...FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA,
  ]);
  return TOOLS_LOCADORA.map((t) => t.name).filter((nome) => !ligadas.has(nome));
}

export function exemplosCobremTodasAsFontes(): boolean {
  const fontes = new Set(EXEMPLOS_DE_PERGUNTA.map((e) => e.fonte));
  return FONTES_DE_CONSULTA.every((fonte) => fontes.has(fonte));
}

export function rotuloVisivel(fonte: FonteDeConsulta): string {
  return ROTULO_DA_FONTE[fonte];
}
