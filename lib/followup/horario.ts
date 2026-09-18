/**
 * Ramo dentro/fora do horário — a mesma janela do agente publicado
 * (`business_hours` em janela-de-atendimento). Sem janela = dentro
 * (falha aberta: um bot sem horário configurado não cala o atendimento).
 */
import {
  lerJanelaDeAtendimento,
  msAteAJanelaAbrir,
} from "@/lib/agent-engine/agent/janela-de-atendimento";

export const HORARIO_DENTRO_BRANCH_ID = "dentro";
export const HORARIO_FORA_BRANCH_ID = "fora";

export function estaDentroDoHorario(triggerConfig: unknown, agora: Date): boolean {
  const janela = lerJanelaDeAtendimento(triggerConfig);
  if (janela === null) return true;
  return msAteAJanelaAbrir(janela, agora) === null;
}
