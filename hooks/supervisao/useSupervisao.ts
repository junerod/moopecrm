"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { KpisDeSupervisao } from "@/lib/supervisao/kpis";
import type { PeriodoPronto } from "@/lib/supervisao/periodo";

export function useSupervisao(periodo: PeriodoPronto, enabled: boolean) {
  return useQuery({
    queryKey: ["metrics", "supervisao", periodo],
    enabled,
    queryFn: () =>
      apiClient
        .get<{ data: KpisDeSupervisao & { periodo: PeriodoPronto; window: { from: string; to: string } } }>(
          `/api/v1/metrics/supervisao?periodo=${periodo}`,
        )
        .then((r) => r.data),
    staleTime: 15_000,
  });
}
