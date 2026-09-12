"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { MetricasDaCampanha } from "@/lib/campanhas/metricas";
import type { SegmentoDaCampanha, StatusDaCampanha } from "@/lib/campanhas/tipos";

export interface CampanhaLista {
  id: string;
  name: string;
  status: StatusDaCampanha;
  channel_session_id: string | null;
  template_id: string | null;
  body_text: string;
  segment: SegmentoDaCampanha;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface CampanhaDetalhe extends CampanhaLista {
  metricas: MetricasDaCampanha;
}

export interface DestinatarioDaCampanha {
  id: string;
  contact_id: string;
  phone: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  failed_at: string | null;
  error: string | null;
  lead_id: string | null;
  message_id: string | null;
}

export function useCampanhas() {
  return useQuery({
    queryKey: ["campanhas"],
    queryFn: () => apiClient.get<{ data: CampanhaLista[] }>("/api/v1/campanhas").then((r) => r.data),
  });
}

export function useCampanha(id: string | null) {
  return useQuery({
    queryKey: ["campanhas", id],
    enabled: !!id,
    queryFn: () =>
      apiClient.get<{ data: CampanhaDetalhe }>(`/api/v1/campanhas/${id}`).then((r) => r.data),
  });
}

export function useDestinatarios(id: string | null) {
  return useQuery({
    queryKey: ["campanhas", id, "recipients"],
    enabled: !!id,
    queryFn: () =>
      apiClient
        .get<{ data: DestinatarioDaCampanha[] }>(`/api/v1/campanhas/${id}/recipients`)
        .then((r) => r.data),
  });
}

export function useCriarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      body_text: string;
      segment: SegmentoDaCampanha;
      channel_session_id?: string | null;
    }) => apiClient.post<{ data: CampanhaLista }>("/api/v1/campanhas", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useIniciarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ data: { status: string; inseridos: number; pulados: number } }>(
        `/api/v1/campanhas/${id}/start`,
        {},
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useCancelarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/campanhas/${id}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useEstimativaSegmento(segment: SegmentoDaCampanha, enabled: boolean) {
  return useQuery({
    queryKey: ["campanhas", "segmento", segment],
    enabled,
    queryFn: () =>
      apiClient
        .post<{ data: { selecionados: number; elegiveis: number; excluidos: number; rotulo: string } }>(
          "/api/v1/campanhas/segmento",
          segment,
        )
        .then((r) => r.data),
    staleTime: 5_000,
  });
}
