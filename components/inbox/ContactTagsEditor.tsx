"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ds/TagChip";
import { Plus } from "@/lib/ui/icons";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useContactTagVocabulary } from "@/hooks/inbox/useConversationTags";

interface Props {
  contactId: string;
  orgId: string;
  tags: string[];
}

/** Edita as tags do CONTATO — persistem na pessoa e reaparecem como sugestão. */
export function ContactTagsEditor({ contactId, orgId, tags }: Props) {
  const [draft, setDraft] = useState("");
  const mutation = useUpdateContact(contactId);
  const { data: vocabulary } = useContactTagVocabulary(orgId);

  function apply(next: string[]) {
    mutation.mutate({ tags: next });
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
    <div className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tags do contato
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Ficam gravadas nesta pessoa. Crie uma vez — a próxima conversa sugere.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {tags.length > 0 ? (
          tags.map((t) => (
            <TagChip
              key={t}
              label={t}
              onRemove={mutation.isPending ? undefined : () => remove(t)}
            />
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sem tags no contato.</span>
        )}
      </div>

      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Ex.: plataforma, rastreamento…"
          maxLength={40}
          disabled={mutation.isPending || tags.length >= 20}
          className="h-7 text-xs"
          aria-label="Adicionar tag ao contato"
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
        <div className="flex flex-wrap gap-1">
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
    </div>
  );
}
