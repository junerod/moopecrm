import type { HTMLAttributes, ReactNode } from "react";

import type { TomDs } from "@/lib/design-system/tones";
import { ESTILO_DO_TOM } from "@/lib/design-system/tones";
import { cn } from "@/lib/utils";

export function StatusBadge({
  tone,
  children,
  className,
  ...rest
}: {
  tone: TomDs;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const cor = ESTILO_DO_TOM[tone];
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{ background: cor.bg, color: cor.fg, ...rest.style }}
    >
      {children}
    </span>
  );
}
