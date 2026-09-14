import Link from "next/link";

import { AppCard } from "@/components/ds/AppCard";

export function PainelDeAjuda({
  titulo,
  texto,
  passos,
  href,
  rotuloDoLink = "Abrir o passo a passo completo",
  testid,
}: {
  titulo: string;
  texto: string;
  passos?: readonly string[];
  href: string;
  rotuloDoLink?: string;
  testid?: string;
}) {
  return (
    <AppCard testid={testid}>
      <p className="text-sm font-semibold text-[var(--color-text)]">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">{texto}</p>
      {passos && passos.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {passos.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-6 text-[var(--color-text)]">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]"
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="mt-3">
        <Link
          href={href}
          className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          {rotuloDoLink}
        </Link>
      </p>
    </AppCard>
  );
}
