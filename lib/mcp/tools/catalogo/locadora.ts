/**
 * Capacidades da locadora — só leitura do cadastro que JÁ existe lá.
 * Falam com o humano que configura o agente. O texto do modelo vive no handler.
 *
 * Fora do pacote "atender" de propósito: ligar Atender no Conversador não
 * pode entregar lookup ao papel que FALA. O agente "Atendimento locadora"
 * põe estas duas só em `operator_tool_ids`.
 */
import { declararTools } from "./tipos";

export const TOOLS_LOCADORA = declararTools([
  {
    name: "moope_lookup_locatario",
    category: "read",
    rotulo: "Identificar locatário",
    explicacao:
      "Confere se o telefone ou o CPF já é cadastro desta locadora. Não cria cliente novo: se não achar, devolve que não é locatário.",
    oQueToca: "Cadastro da locadora",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "moope_get_retrato",
    category: "read",
    rotulo: "Ver situação do locatário",
    explicacao:
      "Mostra placa, contrato, atraso e o link de boleto ou portal que a locadora já tem. Não gera cobrança e não marca nada como pago.",
    oQueToca: "Contrato e cobrança da locadora",
    risco: "seguro",
    pacotes: ["organizar"],
  },
]);
