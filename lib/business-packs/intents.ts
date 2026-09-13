import type { PackIntentSeed, PackSpecialtySeed } from "@/lib/business-packs/tipos";

export interface IntencaoClassificada {
  intent: string;
  specialty_key: string;
  confianca: number;
  incerto: boolean;
}

/**
 * Classificador determinístico do Pack — o mesmo mapa que o router usa.
 * Sem LLM, sem side effect. Serve o test-drive e os testes.
 */
export function classificarIntencao(
  texto: string,
  intents: PackIntentSeed[],
): IntencaoClassificada {
  const normalizado = texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  let melhor: { intent: PackIntentSeed; pontos: number } | null = null;

  for (const intent of intents) {
    let pontos = 0;
    for (const kw of intent.keywords) {
      const k = kw
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      if (k && normalizado.includes(k)) pontos += k.length >= 6 ? 2 : 1;
    }
    for (const ex of intent.examples) {
      const e = ex
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      if (e.length > 12 && normalizado.includes(e.slice(0, 24))) pontos += 3;
    }
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) {
      melhor = { intent, pontos };
    }
  }

  if (!melhor) {
    return { intent: "incerto", specialty_key: "recepcao", confianca: 0, incerto: true };
  }

  const teto = Math.max(
    1,
    melhor.intent.keywords.length + melhor.intent.examples.length,
  );
  const confianca = Math.min(1, melhor.pontos / teto);
  return {
    intent: melhor.intent.name,
    specialty_key: melhor.intent.specialty_key,
    confianca,
    incerto: confianca < 0.15,
  };
}

export function especialidadeDoIntent(
  specialtyKey: string,
  specialties: PackSpecialtySeed[],
): PackSpecialtySeed | null {
  return specialties.find((s) => s.key === specialtyKey) ?? specialties.find((s) => s.is_default) ?? null;
}

const INTENTS_OPERACIONAIS = new Set([
  "boleto",
  "pix",
  "segunda_via",
  "vencimento",
  "pagamento",
  "disponibilidade",
  "preco",
]);

const INTENTS_SENSIVEIS = new Set([
  "problema_carro",
  "manutencao",
  "sinistro",
  "multa",
]);

export function intentEhOperacional(intent: string): boolean {
  return INTENTS_OPERACIONAIS.has(intent);
}

export function intentEhSensivel(intent: string): boolean {
  return INTENTS_SENSIVEIS.has(intent);
}
