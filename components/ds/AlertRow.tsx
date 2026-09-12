import Link from "next/link";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ds/AppIcon";
import type { TomDs } from "@/lib/design-system/tones";
import { cn } from "@/lib/utils";

export function AlertRow({
  href,
  testid,
  icon,
  tone,
  titulo,
  detalhe,
  cta,
  destaque,
}: {
  href: string;
  testid?: string;
  icon: PhosphorIcon;
  tone: TomDs;
  titulo: ReactNode;
  detalhe?: string;
  cta: string;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-[background-color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]",
        destaque
          ? "bg-[var(--color-error-bg)]"
          : "hover:bg-[var(--color-surface-elevated)]",
      )}
    >
      <AppIcon icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-snug text-[var(--color-text)]">
          {titulo}
        </span>
        {detalhe ? (
          <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">{detalhe}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-[12px] font-medium text-[var(--moope-primary)] opacity-80 group-hover:opacity-100">
        {cta}
      </span>
    </Link>
  );
}
