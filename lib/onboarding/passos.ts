/**
 * OS PASSOS DO WIZARD — uma definição só.
 *
 * Eram três listas que discordavam entre si: a ORDEM vivia numa cascata de
 * `if`s no roteador, os RÓTULOS numa lista fixa no indicador de progresso, e o
 * RESUMO final numa terceira lista. O resultado, em 100% das instalações pelo
 * kit (onde a integração de loja vem desligada):
 *
 *  - o indicador mostrava um passo "Loja" que não existia naquela instalação;
 *  - ele aparecia CONCLUÍDO enquanto a pessoa estava no passo seguinte, porque
 *    "feito" era só "índice menor que o atual";
 *  - e a tela final listava "Loja Nuvemshop (pulado)" — o wizard acusando o
 *    usuário de ter deixado de fazer uma tela que nunca lhe foi oferecida.
 *
 * Aqui, quem decide se um passo EXISTE é o próprio passo, e a mesma resposta
 * alimenta o roteador, o indicador e o resumo. Um passo que não se aplica não
 * aparece em lugar nenhum — nem como pendência, nem como culpa.
 */
import type { OnboardingState } from "@/lib/schemas/onboarding";

export interface PassoDoOnboarding {
  /** Segmento da rota em `app/onboarding/<segmento>`. */
  segmento: string;
  /** O nome da PEÇA que a pessoa está montando, não o nome do sistema. */
  rotulo: string;
  /**
   * O passo existe nesta instalação? Integração desligada não vira passo
   * fantasma.
   */
  existe: (ctx: ContextoDoPasso) => boolean;
  /** Já foi resolvido? (inclusive quando a pessoa escolheu pular) */
  cumprido: (state: OnboardingState) => boolean;
  /** Foi resolvido de verdade, ou a pessoa pulou? Alimenta o resumo final. */
  pulado: (state: OnboardingState) => boolean;
}

export interface ContextoDoPasso {
  /** A integração de loja está ligada nesta instalação? */
  lojaLigada: boolean;
}

/** Um passo marcado no estado — com ou sem `skipped`. */
function marcado(valor: unknown): boolean {
  return Boolean(valor);
}

function foiPulado(valor: { skipped?: boolean } | undefined): boolean {
  return Boolean(valor?.skipped);
}

export const PASSOS: readonly PassoDoOnboarding[] = [
  {
    segmento: "welcome",
    rotulo: "Seu negócio",
    existe: () => true,
    cumprido: (s) => marcado(s.welcome),
    pulado: () => false,
  },
  {
    segmento: "connect-whatsapp",
    // O telefone é a primeira peça concreta do funcionário, e é o passo que
    // pede o celular na mão — o instalador já avisa para deixá-lo aberto.
    rotulo: "WhatsApp",
    existe: () => true,
    cumprido: (s) => marcado(s.whatsapp),
    pulado: (s) => foiPulado(s.whatsapp),
  },
  {
    segmento: "connect-nuvemshop",
    rotulo: "Sua loja",
    // A Nuvemshop some da cara do operador neste produto. O passo e o schema
    // ficam, mas o wizard nunca oferece a tela — nem com NUVEMSHOP_ENABLED.
    existe: () => false,
    cumprido: (s) => marcado(s.nuvemshop),
    pulado: (s) => foiPulado(s.nuvemshop),
  },
  {
    segmento: "setup-ai",
    rotulo: "Agente de IA",
    existe: () => true,
    cumprido: (s) => marcado(s.ai),
    pulado: (s) => foiPulado(s.ai),
  },
  {
    segmento: "funil",
    // O quadro vem DEPOIS de treinar de propósito: a sugestão sai da chave que a
    // pessoa acabou de confirmar funcionando, e é o mesmo cérebro que vai
    // atender. Pedir o quadro antes obrigaria a montá-lo no escuro.
    rotulo: "O funil",
    existe: () => true,
    cumprido: (s) => marcado(s.funil),
    pulado: (s) => foiPulado(s.funil),
  },
  {
    segmento: "testar",
    // O wizard terminava entregando a pessoa num inbox vazio. Ver o
    // funcionário responder ANTES de acabar é o que transforma "configurei um
    // sistema" em "contratei alguém" — e é onde o erro aparece antes do
    // primeiro cliente real, não depois.
    rotulo: "Testar o agente",
    existe: () => true,
    cumprido: (s) => marcado(s.teste),
    pulado: (s) => foiPulado(s.teste),
  },
  {
    segmento: "invite-team",
    rotulo: "Seu time",
    existe: () => true,
    cumprido: (s) => marcado(s.team),
    pulado: (s) => foiPulado(s.team),
  },
] as const;

/** Os passos que existem NESTA instalação, na ordem. */
export function passosVisiveis(ctx: ContextoDoPasso): PassoDoOnboarding[] {
  return PASSOS.filter((p) => p.existe(ctx));
}

/**
 * O primeiro passo ainda não resolvido — ou `null` quando não falta nenhum.
 * É a única definição de ordem do wizard.
 */
export function proximoPasso(
  state: OnboardingState,
  ctx: ContextoDoPasso,
): PassoDoOnboarding | null {
  return passosVisiveis(ctx).find((p) => !p.cumprido(state)) ?? null;
}

/**
 * O passo imediatamente atrás do que está na tela.
 *
 * Sem isto o wizard só tinha Pular e Continuar — quem errava o ramo ou
 * pulava o WhatsApp sem querer não tinha como voltar, só avançar. `done`
 * não é um PASSOS: fica depois do último visível.
 */
export function passoAnterior(
  segmentoAtual: string,
  ctx: ContextoDoPasso,
): PassoDoOnboarding | null {
  const visiveis = passosVisiveis(ctx);
  if (segmentoAtual === "done") return visiveis[visiveis.length - 1] ?? null;
  const i = visiveis.findIndex((p) => p.segmento === segmentoAtual);
  if (i <= 0) return null;
  return visiveis[i - 1] ?? null;
}

export interface ItemDoResumo {
  segmento: string;
  rotulo: string;
  feito: boolean;
  pulado: boolean;
}

/**
 * O resumo final. Só lista o que a pessoa realmente encontrou pela frente —
 * um passo que não existe nesta instalação não vira linha, muito menos linha
 * marcada como pulada.
 */
export function resumoDoOnboarding(
  state: OnboardingState,
  ctx: ContextoDoPasso,
): ItemDoResumo[] {
  return passosVisiveis(ctx).map((p) => ({
    segmento: p.segmento,
    rotulo: p.rotulo,
    feito: p.cumprido(state) && !p.pulado(state),
    pulado: p.pulado(state),
  }));
}
