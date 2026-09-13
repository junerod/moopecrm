import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Bloco de formulário — um título, um grupo de campos. Não um card por input. */
export function FormSection({
  titulo,
  descricao,
  children,
  className,
  testid,
}: {
  titulo?: string;
  descricao?: string;
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "space-y-4 rounded-[12px] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]",
        className,
      )}
    >
      {titulo ? (
        <header className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{titulo}</h2>
          {descricao ? (
            <p className="text-sm text-[var(--color-text-muted)]">{descricao}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
