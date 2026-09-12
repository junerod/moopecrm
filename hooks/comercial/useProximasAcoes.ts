"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { ProximaAcaoLinha, VisaoDaAcao } from "@/lib/demandas/listar-proximas-acoes";

export function useProximasAcoes(visao: VisaoDaAcao, opts?: { mine?: boolean; owner?: string }) {
  const qs = new URLSearchParams({ visao });
  if (opts?.mine) qs.set("mine", "1");
  if (opts?.owner) qs.set("owner", opts.owner);
  return useQuery({
    queryKey: ["proximas-acoes", visao, opts?.mine ?? false, opts?.owner ?? ""],
    queryFn: () =>
      apiClient.get<{ data: ProximaAcaoLinha[] }>(`/api/v1/demandas?${qs.toString()}`).then((r) => r.data),
  });
}
