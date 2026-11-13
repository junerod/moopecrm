"use client";
import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { deveAgendarLeitura } from "@/lib/inbox/agendar-leitura";

const DEBOUNCE_MS = 1500;

/**
 * Marca a conversa como lida após permanecer em foco (EPIC-03 S-03.10).
 * Só chama a API quando unread > 0 para evitar writes desnecessários.
 * `pausado` é o "marcar como não lida": o automático não pode desfazer o pedido.
 */
export function useMarkAsRead(
  conversationId: string | null,
  unread: number,
  pausado = false,
) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutate } = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: unknown }>(`/api/v1/conversations/${id}/mark-read`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
    },
  });

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!conversationId || !deveAgendarLeitura(unread, pausado)) return;

    timerRef.current = setTimeout(() => {
      mutate(conversationId);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [conversationId, unread, pausado, mutate]);
}
