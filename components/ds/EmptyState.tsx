import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ds/AppIcon";
import type { TomDs } from "@/lib/design-system/tones";

export function EmptyState({
  icon,
  tone = "blue",
  titulo,
  frase,
  acao,
}: {
  icon: PhosphorIcon;
  tone?: TomDs;
  titulo: string;
  frase?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AppIcon icon={icon} tone={tone} size="lg" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">{titulo}</p>
        {frase ? (
          <p className="max-w-[18rem] text-xs leading-relaxed text-[var(--color-text-muted)]">
            {frase}
          </p>
        ) : null}
      </div>
      {acao}
    </div>
  );
}
