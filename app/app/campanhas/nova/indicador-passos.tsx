"use client";

import { cn } from "@/lib/utils";

export function IndicadorDePassos({
  passos,
  atual,
  onIr,
}: {
  passos: readonly string[];
  atual: number;
  onIr: (i: number) => void;
}) {
  return (
    <ol className="mb-8 flex w-full items-center" aria-label="Passos da campanha">
      {passos.map((rotulo, i) => {
        const ativo = i === atual;
        const feito = i < atual;
        return (
          <li key={rotulo} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              data-passo-ativo={ativo ? "1" : "0"}
              onClick={() => i <= atual && onIr(i)}
              className="flex min-w-0 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                  ativo &&
                    "bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]",
                  feito && "bg-[var(--moope-primary)] text-white",
                  !ativo &&
                    !feito &&
                    "bg-[var(--color-surface)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "hidden max-w-[5.5rem] truncate text-[11px] sm:block",
                  ativo ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                )}
              >
                {rotulo}
              </span>
            </button>
            {i < passos.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-1 mb-5 h-px min-w-3 flex-1 sm:mb-6",
                  feito ? "bg-[var(--moope-primary)]" : "bg-[var(--color-border)]",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
