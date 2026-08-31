"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { useChannelSessions } from "@/hooks/channels/useChannelSessions";

/**
 * Número WORKING → Contatos e o recorte recente do inbox acompanham
 * o aparelho sozinhos. Reconsultar a cada 5 min, e de novo depois
 * de reconectar (a chave some quando o status deixa de ser WORKING).
 */
const INTERVALO_MS = 5 * 60 * 1000;
const ultimoPedido = new Map<string, number>();

export function forcarProximaSincronizacao(sessionId?: string) {
  if (sessionId) {
    ultimoPedido.delete(`ativo:${sessionId}`);
    return;
  }
  ultimoPedido.clear();
}

export function useSincronizarContatosDoAparelho(enabled: boolean): {
  whatsappNoAr: boolean;
  atualizando: boolean;
  atualizarAgora: () => Promise<void>;
} {
  const qc = useQueryClient();
  const { data: sessions } = useChannelSessions({
    enabled,
    refetchInterval: enabled ? 60_000 : undefined,
  });
  const [atualizando, setAtualizando] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const puxar = useCallback(
    async (forcar: boolean) => {
      if (!enabled || !sessions) return;
      const agora = Date.now();

      for (const c of sessions) {
        const chave = `ativo:${c.id}`;
        if (c.status !== "WORKING" || !c.waha_session_name) {
          ultimoPedido.delete(chave);
          continue;
        }
        const ultimo = ultimoPedido.get(chave) ?? 0;
        if (!forcar && ultimo > 0 && agora - ultimo < INTERVALO_MS) continue;
        ultimoPedido.set(chave, agora);

        try {
          const res = await apiClient.post<{
            data?: {
              historico?: {
                contatos?: number;
                conversas?: number;
                puladas?: number;
                loja_curta?: boolean;
              };
            };
          }>(`/api/v1/channel-sessions/${c.id}/historico`, {}, { timeoutMs: 280_000 });
          if (forcar) {
            const n = res.data?.historico?.contatos;
            const fios = res.data?.historico?.conversas;
            if (res.data?.historico?.loja_curta && typeof n === "number") {
              toast.warning(
                `O WhatsApp só entregou ${n} nesta sessão. Se o celular tem mais, abra Canais e reconecte o número — às vezes precisa escanear o QR de novo.`,
              );
            } else if (typeof n === "number" || typeof fios === "number") {
              const partes: string[] = [];
              if (typeof n === "number") {
                partes.push(
                  n === 0
                    ? "nenhum contato novo"
                    : `${n} contato${n === 1 ? "" : "s"} do aparelho`,
                );
              }
              if (typeof fios === "number" && fios > 0) {
                partes.push(
                  `${fios} conversa${fios === 1 ? "" : "s"} nova${fios === 1 ? "" : "s"} no inbox`,
                );
              }
              toast.success(partes.join(" · ") || "Nada novo nesta rodada.");
            }
          }
        } catch (err: unknown) {
          if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
            continue;
          }
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            ultimoPedido.delete(chave);
          }
          if (forcar && err instanceof ApiError) {
            toast.error(err.message || "Não trouxe os contatos do aparelho.");
          }
        } finally {
          if (vivo.current) {
            void qc.invalidateQueries({ queryKey: ["contacts"] });
            void qc.invalidateQueries({ queryKey: ["conversations"] });
            void qc.invalidateQueries({ queryKey: ["conversation-counts"] });
            void qc.invalidateQueries({ queryKey: ["channel-historico", c.id] });
          }
        }
      }
    },
    [enabled, sessions, qc],
  );

  useEffect(() => {
    void puxar(false);
  }, [puxar]);

  const atualizarAgora = useCallback(async () => {
    setAtualizando(true);
    try {
      forcarProximaSincronizacao();
      await puxar(true);
    } finally {
      if (vivo.current) setAtualizando(false);
    }
  }, [puxar]);

  return {
    whatsappNoAr: Boolean(
      sessions?.some((c) => c.status === "WORKING" && c.waha_session_name),
    ),
    atualizando,
    atualizarAgora,
  };
}
