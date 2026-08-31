"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

export function useImportarConversa(contactId: string, jaTemFio = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{
        data: {
          mensagens: number;
          ja_existiam?: number;
          lidas?: number;
          conversation_id: string | null;
        };
      }>(`/api/v1/contacts/${contactId}/historico`, {}, { timeoutMs: 180_000 });
      return res.data;
    },
    onSuccess: (data) => {
      const novas = data.mensagens;
      const ja = data.ja_existiam ?? 0;
      const lidas = data.lidas ?? 0;
      if (lidas === 0) {
        toast.error(
          "O aparelho não entregou mensagens deste chat. Reconecte o WhatsApp e tente de novo.",
        );
        return;
      }
      if (novas === 0 && ja > 0) {
        toast.success(
          `As ${ja} ${ja === 1 ? "mensagem" : "mensagens"} deste fio já estavam no CRM.`,
        );
        return;
      }
      toast.success(
        ja > 0
          ? `Trouxe ${novas} ${novas === 1 ? "mensagem" : "mensagens"} (${ja} já estavam).`
          : jaTemFio
            ? `Atualizou com ${novas} ${novas === 1 ? "mensagem" : "mensagens"}.`
            : `Trouxe ${novas} ${novas === 1 ? "mensagem" : "mensagens"}.`,
      );
      void qc.invalidateQueries({ queryKey: ["contact", contactId] });
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Não foi possível importar a conversa.",
      );
    },
  });
}
