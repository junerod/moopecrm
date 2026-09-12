"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ds/TagChip";
import { Plus } from "@/lib/ui/icons";
import {
  useUpdateConversationTags,
  useConversationTagVocabulary,
} from "@/hooks/inbox/useConversationTags";

interface Props {
  conversationId: string;
  orgId: string;
  tags: string[];
}

/** G3-05: aplica/remove tags de atendimento na conversa, com sugestão do vocabulário em uso. */
export function ConversationTagsEditor({ conversationId, orgId, tags }: Props) {
  const [draft, setDraft] = useState("");
  const mutation = useUpdateConversationTags();
  const { data: vocabulary } = useConversationTagVocabulary(orgId);

  function apply(next: string[]) {
    mutation.mutate({ conversation_id: conversationId, tags: next });
  }

  function add(raw: string) {
    const tag = raw.trim().toLowerCase().slice(0, 40);
    if (!tag || tags.includes(tag) || tags.length >= 20) return;
    apply([...tags, tag]);
    setDraft("");
  }

  function remove(tag: string) {
    apply(tags.filter((t) => t !== tag));
  }

  const suggestions = (vocabulary ?? []).filter((t) => !tags.includes(t)).slice(0, 12);

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tags desta conversa
      </h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Só este atendimento. Clique numa tag já usada para reaproveitar.
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {tags.length > 0 ? (
          tags.map((t) => (
            <TagChip
              key={t}
              label={t}
              onRemove={mutation.isPending ? undefined : () => remove(t)}
            />
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sem tags nesta conversa.</span>
        )}
      </div>

      <div className="mt-2 flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Nova tag…"
          maxLength={40}
          disabled={mutation.isPending || tags.length >= 20}
          className="h-7 text-xs"
          aria-label="Adicionar tag à conversa"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={() => add(draft)}
          disabled={mutation.isPending || !draft.trim() || tags.length >= 20}
          aria-label="Adicionar tag"
        >
          <Plus size={12} weight="regular" aria-hidden />
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.map((t) => (
            <TagChip
              key={t}
              label={t}
              dashed
              onSelect={() => add(t)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
