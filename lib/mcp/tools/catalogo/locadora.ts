/**
 * Capacidades da locadora — só leitura do cadastro que JÁ existe lá.
 * Fora do pacote "atender": o Conversador não fala com estas tools.
 */
import { declararTools } from "./tipos";

export const TOOLS_LOCADORA = declararTools([
  {
    name: "moope_lookup_locatario",
    category: "read",
    rotulo: "Identificar locatário",
    explicacao:
      "Confere se o telefone, o CPF ou a placa já é cadastro desta locadora. Não cria cliente novo.",
    oQueToca: "Cadastro da locadora",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_get_retrato",
    category: "read",
    rotulo: "Ver situação do locatário",
    explicacao:
      "Mostra placa, contrato, atraso, documentos e o link de boleto ou portal que a locadora já tem.",
    oQueToca: "Contrato e cobrança da locadora",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_get_atendimento",
    category: "read",
    rotulo: "Menu do WhatsApp",
    explicacao:
      "Busca o menu que a locadora editou no MOOPE (Textos do WhatsApp). O bot manda esse texto na entrada.",
    oQueToca: "Textos da locadora",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_listar_oferta",
    category: "read",
    rotulo: "Veículos disponíveis",
    explicacao: "Lista carros livres para quem quer alugar. Sem inventar preço ou fechar contrato.",
    oQueToca: "Frota disponível",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_lookup_investidor",
    category: "read",
    rotulo: "Identificar investidor",
    explicacao: "Confere se o telefone ou o CPF é investidor desta locadora. Não cria cadastro.",
    oQueToca: "Cadastro de investidores",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_get_retrato_investidor",
    category: "read",
    rotulo: "Portal do investidor",
    explicacao: "Link do portal e último período de fechamento. Não envia PDF nem valor inventado.",
    oQueToca: "Portal do investidor",
    risco: "seguro",
    pacotes: ["organizar"],
  },
]);
