"use client";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { AgentVersionRow } from "@/hooks/ai/useAgentVersions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgentVersionRow | null;
  published: AgentVersionRow | null;
  onConfirm: () => void;
  isPending: boolean;
}

function diffArr(prev: string[], next: string[]) {
  const added = next.filter((x) => !prev.includes(x));
  const removed = prev.filter((x) => !next.includes(x));
  return { added, removed };
}

export function PublishConfirmDialog({
  open,
  onOpenChange,
  draft,
  published,
  onConfirm,
  isPending,
}: Props) {
  const toolsDiff = diffArr(published?.tool_ids ?? [], draft?.tool_ids ?? []);
  const promptDeltaChars = draft
    ? draft.system_prompt.length - (published?.system_prompt.length ?? 0)
    : 0;
  const modelChanged = draft != null && (!published || draft.model !== published.model);
  const providerChanged = draft != null && (!published || draft.provider !== published.provider);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {draft ? `Publicar v${draft.version_number}?` : "Colocar no ar o que está nesta tela?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta versão passa a responder neste WhatsApp.
            {published ? ` A que está no ar agora (v${published.version_number}) sai de cena.` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {draft ? (
        <div className="space-y-2 rounded-md border border-border/60 p-3 text-xs">
          {providerChanged ? (
            <p>
              <strong>Provider:</strong>{" "}
              {published ? `${published.provider} → ${draft.provider}` : draft.provider}
            </p>
          ) : null}
          {modelChanged ? (
            <p>
              <strong>Modelo:</strong>{" "}
              {published ? `${published.model} → ${draft.model}` : draft.model}
            </p>
          ) : null}
          {toolsDiff.added.length > 0 ? (
            <p>
              <strong>Tools adicionadas:</strong> {toolsDiff.added.join(", ")}
            </p>
          ) : null}
          {toolsDiff.removed.length > 0 ? (
            <p>
              <strong>Tools removidas:</strong> {toolsDiff.removed.join(", ")}
            </p>
          ) : null}
          <p>
            <strong>Prompt:</strong>{" "}
            {promptDeltaChars > 0
              ? `+${promptDeltaChars} chars`
              : promptDeltaChars < 0
                ? `${promptDeltaChars} chars`
                : "sem alteração"}
          </p>
        </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            O que está nesta tela substitui a versão que já responde neste WhatsApp.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Publicando…" : draft ? `Publicar v${draft.version_number}` : "Publicar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
