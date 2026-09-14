import type { TomDs } from "@/lib/design-system/tones";
import { Car, Handshake, Pulse, Scales, Storefront } from "@/lib/ui/icons";

type IconePack = typeof Car;

const VISUAL: Record<string, { icone: IconePack; tom: TomDs; frase: string }> = {
  locadora_veiculos: {
    icone: Car,
    tom: "teal",
    frase: "Atendimento, aluguel, frota e cobrança no WhatsApp.",
  },
  escritorio_advocacia: {
    icone: Scales,
    tom: "indigo",
    frase: "Recepção, consulta, documentos e retorno — sem inventar processo.",
  },
  vendas_saas: {
    icone: Storefront,
    tom: "blue",
    frase: "Captação, demo, proposta e sucesso do cliente.",
  },
  comercial_geral: {
    icone: Handshake,
    tom: "cyan",
    frase: "Atenda, qualifique, envie proposta e acompanhe a venda.",
  },
  clinica_medica: {
    icone: Pulse,
    tom: "green",
    frase: "Agenda, documentos, convênio e retorno do paciente.",
  },
  clinica_odontologica: {
    icone: Pulse,
    tom: "teal",
    frase: "Avaliação, orçamento, agenda e relacionamento.",
  },
};

export function visualDoPack(id: string, fallback = "") {
  return VISUAL[id] ?? { icone: Storefront, tom: "blue" as TomDs, frase: fallback };
}
