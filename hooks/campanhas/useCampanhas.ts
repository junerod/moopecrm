"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { MetricasDaCampanha } from "@/lib/campanhas/metricas";
import type {
  SegmentoDaCampanha,
  SelecaoDeCanais,
  SettingsDaCampanha,
  StatusDaCampanha,
} from "@/lib/campanhas/tipos";

export interface CampanhaLista {
  id: string;
  name: string;
  status: StatusDaCampanha;
  channel_session_id: string | null;
  template_id: string | null;
  body_text: string;
  segment: SegmentoDaCampanha;
  settings?: SettingsDaCampanha;
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
  nome?: string | null;
  phone: string | null;
  channel?: string | null;
  destination?: string | null;
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

export interface ModeloDeCampanha {
  id: string;
  title: string;
  body: string;
}

export interface OpcoesDeCampanha {
  tags: string[];
  papeis: string[];
  origens: string[];
  responsaveis: Array<{ id: string; role: string; nome?: string }>;
  funis: Array<{
    id: string;
    name: string;
    crm_stages?: Array<{ id: string; name: string }>;
  }>;
  sessoes: Array<{ id: string; rotulo: string; provider: string }>;
  templates_oficiais: Array<{ id: string; name: string; language: string }>;
  whatsapp: { conectado: boolean; rotulo: string };
  email: { configurado: boolean; rotulo: string };
  dispatch: { campaign_dispatch_real: boolean; whatsapp: string; email: string };
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
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      const prep = q.state.data?.settings?.preparing;
      return s === "running" || s === "scheduled" || prep ? 3000 : false;
    },
    queryFn: () =>
      apiClient.get<{ data: CampanhaDetalhe }>(`/api/v1/campanhas/${id}`).then((r) => r.data),
  });
}

export function useDestinatarios(id: string | null) {
  return useQuery({
    queryKey: ["campanhas", id, "recipients"],
    enabled: !!id,
    refetchInterval: 4000,
    queryFn: () =>
      apiClient
        .get<{ data: DestinatarioDaCampanha[] }>(`/api/v1/campanhas/${id}/recipients`)
        .then((r) => r.data),
  });
}

export function useOpcoesCampanha() {
  return useQuery({
    queryKey: ["campanhas", "opcoes"],
    queryFn: () =>
      apiClient.get<{ data: OpcoesDeCampanha }>("/api/v1/campanhas/opcoes").then((r) => r.data),
  });
}

export function useModelosCampanha() {
  return useQuery({
    queryKey: ["campanhas", "modelos"],
    queryFn: () =>
      apiClient.get<{ data: ModeloDeCampanha[] }>("/api/v1/campanhas/modelos").then((r) => r.data),
  });
}

export function useAtualizarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      body_text?: string;
      segment?: SegmentoDaCampanha;
      channel_session_id?: string | null;
      template_id?: string | null;
      scheduled_at?: string | null;
      settings?: SettingsDaCampanha;
    }) => apiClient.patch<{ data: CampanhaLista }>(`/api/v1/campanhas/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
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
      template_id?: string | null;
      scheduled_at?: string | null;
      settings?: SettingsDaCampanha;
    }) => apiClient.post<{ data: CampanhaLista }>("/api/v1/campanhas", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
  });
}

export function useIniciarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{
        data: { status: string; preparing?: boolean; elegiveis?: number; dispatch?: unknown };
      }>(`/api/v1/campanhas/${id}/start`, {}),
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

export function useEstimativaSegmento(
  segment: SegmentoDaCampanha,
  enabled: boolean,
  channels?: SelecaoDeCanais,
  q?: string,
) {
  return useQuery({
    queryKey: ["campanhas", "segmento", segment, channels, q],
    enabled,
    queryFn: () =>
      apiClient
        .post<{
          data: {
            selecionados: number;
            elegiveis: number;
            excluidos: number;
            destinos: number;
            exclusoes: {
              bloqueados: number;
              opt_out: number;
              sem_whatsapp: number;
              sem_email: number;
              sem_canal: number;
            };
            alcance: { whatsapp: number; email: number; ambos: number; nenhum: number };
            atinge_base_inteira: boolean;
            rotulo: string;
            preview: Array<{
              id: string;
              nome: string;
              telefone: string | null;
              email: string | null;
              papel?: string | null;
              tem_whatsapp?: boolean;
              tem_email?: boolean;
            }>;
          };
        }>("/api/v1/campanhas/segmento", {
          ...segment,
          channels,
          preview_limit: 40,
          q: q?.trim() || undefined,
        })
        .then((r) => r.data),
    staleTime: 5_000,
  });
}

export function useIaRascunho() {
  return useMutation({
    mutationFn: (body: { texto: string; acao: "melhorar" | "encurtar" | "comercial" | "profissional" | "tres_versoes" }) =>
      apiClient
        .post<{ data: { texto: string; versoes: string[]; enviou: boolean } }>(
          "/api/v1/campanhas/ia-rascunho",
          body,
        )
        .then((r) => r.data),
  });
}

export async function uploadMidiaCampanha(file: File, campaignId?: string) {
  const form = new FormData();
  form.append("file", file);
  if (campaignId) form.append("campaign_id", campaignId);
  const res = await fetch("/api/v1/campanhas/midia", { method: "POST", body: form });
  const json = (await res.json()) as {
    data?: {
      storage_path: string;
      mime: string;
      size_bytes: number;
      filename: string;
      kind: "image" | "video" | "document";
      preview_url?: string | null;
    };
    error?: { message: string };
  };
  if (!res.ok || !json.data) throw new Error(json.error?.message ?? "Falha no upload");
  return json.data;
}
