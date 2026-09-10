"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { ehResidualSupersedida } from "@/lib/channels/sessoes-residuais";

export interface ChannelSession {
  id: string;
  /**
   * Nome da sessão no transporte. NULL no canal oficial, que não tem sessão a
   * iniciar, deslogar ou apagar — é o que distingue, na tela, quem depende do
   * serviço de WhatsApp para ser excluído. O tipo dizia `string` e mentia: um
   * canal oficial rendia rótulo vazio onde a tela concatenava esse campo.
   */
  waha_session_name: string | null;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  status_reason: string | null;
  last_health_check_at: string | null;
  last_status_change_at: string | null;
  daily_message_limit: number;
  is_warmup_complete: boolean | null;
  created_at: string;
}

export type ConnectionHealth = "connected" | "connecting" | "down" | "none" | "unknown";

/**
 * Como um canal se chama na tela. Existe porque nenhum dos três campos é
 * garantido: o canal oficial não tem nome de sessão no transporte, e um canal
 * recém-criado ainda não tem apelido nem número — a cadeia sem o último degrau
 * rendia uma opção em branco no seletor.
 */
export function channelLabel(
  c: Pick<ChannelSession, "display_name" | "phone_number" | "waha_session_name">,
): string {
  return c.display_name || c.phone_number || c.waha_session_name || "Número sem nome";
}

/**
 * Lista os canais WhatsApp (channel_sessions) da org ativa. Fonte única
 * para o seletor do inbox, o sinal de saúde da sidebar e a Central de Conexões.
 *
 * Devolve um objeto explícito (e não o resultado cru do react-query) por dois
 * motivos: `schemaOutdated` vem do `meta` da resposta e se perderia num `select`,
 * e `isError` precisa chegar a quem renderiza — lista vazia porque a consulta
 * falhou é indistinguível de "nenhum número conectado", que é o convite a parear
 * de novo um número que já está no ar.
 */
export function useChannelSessions(opts?: { refetchInterval?: number; enabled?: boolean }) {
  const query = useQuery({
    queryKey: ["channel-sessions"],
    queryFn: async () => {
      return apiClient.get<{
        data: ChannelSession[];
        meta?: { schema_outdated?: boolean };
      }>("/api/v1/channel-sessions");
    },
    staleTime: 15_000,
    refetchInterval: opts?.refetchInterval,
    enabled: opts?.enabled ?? true,
  });

  return {
    data: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    /** A migration 0100 não rodou neste banco: canal excluído volta à lista. */
    schemaOutdated: query.data?.meta?.schema_outdated === true,
  };
}

/**
 * Saúde agregada da organização.
 *
 * Residual sem telefone não entra: vermelho só vence quando o canal caído
 * é um número de verdade (tem telefone) ou quando não há WORKING nenhuma.
 * Depois amarelo (conectando), senão verde.
 *
 * `none` é uma AFIRMAÇÃO ("esta org não tem número"), então só sai de uma
 * listagem que chegou. Quem não conseguiu carregar pede `unknown` — ver
 * ConnectionHealthDot.
 */
export function deriveOverallHealth(sessions: ChannelSession[] | undefined): ConnectionHealth {
  if (!sessions || sessions.length === 0) return "none";
  // Residual sem telefone não decide o estado da organização: se há WORKING,
  // ela prevalece. Número real caído (com telefone) continua vermelho — é
  // multi-número, não lixo de pareamento. Ver `lib/channels/sessoes-residuais`.
  const relevantes = sessions.filter((s) => !ehResidualSupersedida(s, sessions));
  if (relevantes.length === 0) return "none";
  if (relevantes.some((s) => s.status === "FAILED" || s.status === "STOPPED")) return "down";
  if (relevantes.some((s) => s.status === "STARTING" || s.status === "SCAN_QR_CODE")) {
    return "connecting";
  }
  return "connected";
}
