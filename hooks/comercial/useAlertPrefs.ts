"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface AlertPrefs {
  alert_whatsapp_phone: string | null;
  alert_proxima_acao: boolean;
  alert_antecedencia_min: 10 | 30 | 60;
}

export function useAlertPrefs() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["me-alert-prefs"],
    queryFn: () => apiClient.get<{ data: AlertPrefs }>("/api/v1/me/alert-prefs").then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: (patch: Partial<AlertPrefs>) =>
      apiClient.patch<{ data: AlertPrefs }>("/api/v1/me/alert-prefs", patch).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me-alert-prefs"] });
    },
  });
  return { ...query, salvar: mutation };
}
