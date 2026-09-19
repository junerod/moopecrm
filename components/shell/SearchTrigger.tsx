"use client";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { MagnifyingGlass } from "@/lib/ui/icons";
import { CommandPalette } from "@/components/shell/CommandPalette";

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  // `enableOnFormTags`: o atalho precisa funcionar com o cursor dentro do
  // composer do inbox, que é onde o operador passa o dia.
  useHotkeys("mod+k", () => setOpen(true), { preventDefault: true, enableOnFormTags: true });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)] md:h-10 md:w-full md:max-w-xl md:justify-start md:gap-2 md:px-3.5"
        aria-label="Buscar contatos, conversas, leads"
      >
        <MagnifyingGlass size={15} aria-hidden className="shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate text-left text-[13px] md:block">
          Buscar contatos, conversas, leads...
        </span>
        <kbd className="hidden shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-subtle)] md:inline">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
