import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ds/AppIcon";
import { AppCard } from "@/components/ds/AppCard";
import type { TomDs } from "@/lib/design-system/tones";

export function MetricCard({
  icon,
  tone,
  label,
  value,
  delta,
}: {
  icon: PhosphorIcon;
  tone: TomDs;
  label: string;
  value: string;
  delta?: ReactNode;
}) {
  return (
    <AppCard>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</p>
        <AppIcon icon={icon} tone={tone} size="md" />
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none tabular-nums tracking-tight text-[var(--color-text)]">
        {value}
      </p>
      {delta}
    </AppCard>
  );
}
