"use client";
import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { apiClient } from "@/lib/api/client";
import { devePingarHeartbeat, HEARTBEAT_PING_MS } from "@/lib/inbox/heartbeat";
import { logger } from "@/lib/logger";

/**
 * Ping leve enquanto o atendente usa o app de verdade.
 * Intervalo 2 min; aba oculta não pinga; limpa no unmount.
 * Reusa PATCH /attendants/availability/:id com `{ heartbeat: true }`.
 */
export function useAttendantHeartbeat() {
  const { user } = useAuth();
  const ultimoPingEm = useRef<Date | null>(null);
  const userId = user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;

    async function pingar() {
      if (cancelado) return;
      const agora = new Date();
      if (
        !devePingarHeartbeat({
          isAvailable: true,
          visivel: typeof document === "undefined" ? false : !document.hidden,
          agora,
          ultimoPingEm: ultimoPingEm.current,
        })
      ) {
        return;
      }
      try {
        await apiClient.patch(`/api/v1/attendants/availability/${userId}`, { heartbeat: true });
        ultimoPingEm.current = agora;
      } catch (err) {
        logger.warn("[heartbeat] ping falhou", {
          detail: err instanceof Error ? err.message.slice(0, 120) : "desconhecido",
        });
      }
    }

    void pingar();
    const id = window.setInterval(() => void pingar(), HEARTBEAT_PING_MS);
    const onVis = () => {
      if (!document.hidden) void pingar();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);
}
