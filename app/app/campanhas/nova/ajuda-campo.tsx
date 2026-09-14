"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppIcon } from "@/components/ds/AppIcon";
import { Question } from "@/lib/ui/icons";

export function AjudaCampo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          aria-label={`Ajuda: ${titulo}`}
        >
          <AppIcon icon={Question} tone="indigo" size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-1.5 p-3">
        <p className="text-sm font-semibold text-[var(--color-text)]">{titulo}</p>
        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{texto}</p>
      </PopoverContent>
    </Popover>
  );
}
