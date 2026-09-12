import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { ESTILO_DO_TOM, ESTILO_NAV_DO_TOM, type TomDs } from "@/lib/design-system/tones";
import { cn } from "@/lib/utils";

const TAMANHO = {
  sm: { box: 28, icon: 15 },
  md: { box: 32, icon: 17 },
  lg: { box: 36, icon: 19 },
} as const;

export function AppIcon({
  icon: Icon,
  tone = "blue",
  size = "md",
  surface = "default",
  className,
  label,
}: {
  icon: PhosphorIcon;
  tone?: TomDs;
  size?: keyof typeof TAMANHO;
  /** `nav` = ícone tingido sem quadrado claro (some no navy). */
  surface?: "default" | "nav";
  className?: string;
  label?: string;
}) {
  const t = TAMANHO[size];
  const cor = ESTILO_DO_TOM[tone];
  const nav = surface === "nav";
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", className)}
      style={{
        width: nav ? 18 : t.box,
        height: nav ? 18 : t.box,
        background: nav ? "transparent" : cor.bg,
        color: nav ? ESTILO_NAV_DO_TOM[tone] : cor.fg,
      }}
    >
      <Icon size={nav ? 18 : t.icon} weight="duotone" />
    </span>
  );
}
