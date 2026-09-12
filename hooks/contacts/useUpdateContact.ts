"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Contact } from "@/lib/types/contacts";
import type { ContactPatch } from "@/lib/schemas/contacts";

/** Atualiza o embed `contacts` da conversa aberta sem esperar o refetch. */
export function aplicarPapelNoEmbed(
  old: unknown,
  contactId: string,
  papel: string | null,
): unknown {
  if (!old || typeof old !== "object") return old;
  const conv = old as { contacts?: unknown };
  const c = conv.contacts;
  if (Array.isArray(c)) {
    const primeiro = c[0] as { id?: string } | undefined;
    if (!primeiro || primeiro.id !== contactId) return old;
    return { ...conv, contacts: [{ ...primeiro, papel }] };
  }
  if (c && typeof c === "object" && (c as { id?: string }).id === contactId) {
    return { ...conv, contacts: { ...(c as object), papel } };
  }
  return old;
}

export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ContactPatch) =>
      apiClient.patch<{ data: Contact }>(`/api/v1/contacts/${id}`, patch),
    onError: showApiError,
    onSuccess: (_res, patch) => {
      if ("papel" in patch) {
        qc.setQueriesData({ queryKey: ["conversation"] }, (old) =>
          aplicarPapelNoEmbed(old, id, patch.papel ?? null),
        );
      }
      qc.invalidateQueries({ queryKey: ["contact", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      // O Inbox (CRMSidePanel) lê o contato via conversation.contacts, não via
      // ["contact", id] — sem isto, editar tags/nome do contato por aqui não
      // refletia na tela até trocar de conversa (parecia "não fez nada").
      qc.invalidateQueries({ queryKey: ["conversations"] });
      // Deep-link e conversa fora da lista comercial usam a chave singular.
      qc.invalidateQueries({ queryKey: ["conversation"] });
      if ("tags" in patch) {
        qc.invalidateQueries({ queryKey: ["contact-tag-vocabulary"] });
      }
    },
  });
}
