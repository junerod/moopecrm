import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  icon,
  titulo,
  descricao,
  acoes,
  className,
}: {
  icon?: ReactNode;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-[var(--color-text)] md:text-2xl">
            {titulo}
          </h1>
          {descricao ? (
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-text-muted)] md:text-sm">{descricao}</p>
          ) : null}
        </div>
      </div>
      {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}
