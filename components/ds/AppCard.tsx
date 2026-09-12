import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppCard({
  children,
  className,
  testid,
  padded = true,
  hover,
}: {
  children: ReactNode;
  className?: string;
  testid?: string;
  padded?: boolean;
  hover?: boolean;
}) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "rounded-[12px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]",
        padded && "px-4 py-3.5",
        hover &&
          "transition-[box-shadow,border-color] duration-150 hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
