import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeader({
  titulo,
  subtitulo,
  cta,
  href,
  icon,
}: {
  titulo: string;
  subtitulo?: string;
  cta?: string;
  href?: string;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            {titulo}
          </h2>
        </div>
        {subtitulo ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{subtitulo}</p>
        ) : null}
      </div>
      {href && cta ? (
        <Link
          href={href}
          className="shrink-0 text-[12px] font-medium text-[var(--moope-primary)] transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]"
        >
          {cta} →
        </Link>
      ) : null}
    </header>
  );
}
