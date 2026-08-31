"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { PROVEDORES } from "@/lib/ai/pontos/provedores";

/**
 * Derivado de `lib/ai/pontos/provedores.ts` — a lista única desde a migration
 * 0127. Como literal fixo aqui, a tela de Credenciais não tinha como cadastrar
 * OpenRouter, embora o painel de Provedores a oferecesse.
 */
export type Provider = (typeof PROVEDORES)[number]["id"];

export interface CredentialRow {
  id: string;
  organization_id: string;
  provider: Provider;
  label: string;
  api_key_last4: string | null;
  validated_at: string | null;
  validation_error: string | null;
  /**
   * No banco é `text[]` (os ids). A tela nunca lista os nomes — quem interpola
   * o array numa frase junta cem ids com vírgula e joga isso no toast. Contagem
   * via `quantidadeDeModelos`.
   */
  models_available: string[] | number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  data: CredentialRow[];
}

export const credentialsListQueryKey = ["ai", "credentials", "list"] as const;

export function useCredentialsList(opts?: { initialData?: CredentialRow[] }) {
  return useQuery({
    queryKey: credentialsListQueryKey,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ListResponse>("/api/v1/ai/credentials");
        return res.data;
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
    initialData: opts?.initialData,
  });
}

/** Conta sem nunca mostrar o nome do modelo. Array vira length; número fica. */
export function quantidadeDeModelos(
  models: CredentialRow["models_available"],
): number | null {
  if (typeof models === "number" && Number.isFinite(models)) return models;
  if (Array.isArray(models)) return models.length;
  return null;
}

export function credentialStatus(row: CredentialRow): "validated" | "validating" | "invalid" | "inactive" {
  if (!row.is_active) return "inactive";
  if (row.validation_error) return "invalid";
  if (row.validated_at) return "validated";
  return "validating";
}
