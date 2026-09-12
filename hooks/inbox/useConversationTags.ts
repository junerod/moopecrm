"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Conversation } from "@/lib/types/messaging";

interface UpdateTagsArgs {
  conversation_id: string;
  tags: string[];
}

/** G3-05: aplica/remove tags de uma conversa via PATCH; refaz o inbox. */
export function useUpdateConversationTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateTagsArgs) =>
      apiClient.patch<{ data: Conversation }>(
        `/api/v1/conversations/${args.conversation_id}`,
        { tags: args.tags },
      ),
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      showApiError(err);
    },
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", args.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversation-tag-vocabulary"] });
    },
  });
}

/**
 * G3-05: vocabulário de tags de conversa (canônico + em uso).
 * Via server route — o cookie de sessão é HttpOnly, então o browser-supabase
 * não autentica; a leitura org-scoped passa pelo servidor.
 */
export function useConversationTagVocabulary(orgId: string | null) {
  return useQuery({
    queryKey: ["conversation-tag-vocabulary", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const res = await apiClient.get<{ data: string[] }>("/api/v1/conversation-tags");
      return res.data;
    },
  });
}

/** Tags já gravadas em outros contatos da org — reaproveitar, não redigitar. */
export function useContactTagVocabulary(orgId: string | null) {
  return useQuery({
    queryKey: ["contact-tag-vocabulary", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const res = await apiClient.get<{ data: string[] }>("/api/v1/contact-tags");
      return res.data;
    },
  });
}
