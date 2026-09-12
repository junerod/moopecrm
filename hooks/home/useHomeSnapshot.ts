"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { SnapshotDaHome } from "@/lib/home/tipos";
import type { PeriodoPronto } from "@/lib/supervisao/periodo";

export function useHomeSnapshot(periodo: PeriodoPronto) {
  return useQuery({
    queryKey: ["home", "snapshot", periodo],
    queryFn: () =>
      apiClient
        .get<{ data: SnapshotDaHome }>(`/api/v1/home/snapshot?periodo=${periodo}`)
        .then((r) => r.data),
    staleTime: 15_000,
  });
}
