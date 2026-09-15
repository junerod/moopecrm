"use client";

import { AppCard } from "@/components/ds/AppCard";
import { LinkDoManual } from "@/components/manual/LinkDoManual";

export function PainelDeAjuda({
  titulo,
  texto,
  passos,
  capitulo,
  href,
  rotuloDoLink = "Abrir o passo a passo completo",
  testid,
}: {
  titulo: string;
  texto: string;
  passos?: readonly string[];
  capitulo?: string;
  /** @deprecated use `capitulo` — o guia abre na tela atual. */
  href?: string;
  rotuloDoLink?: string;
  testid?: string;
}) {
  const id = capitulo ?? capituloDoHref(href);

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
      {id ? (
        <p className="mt-3">
          <LinkDoManual
            capitulo={id}
            className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            {rotuloDoLink}
          </LinkDoManual>
        </p>
      ) : null}
    </AppCard>
  );
}

function capituloDoHref(href?: string): string | null {
  if (!href) return null;
  const hash = href.split("#")[1];
  return hash || "primeiro-acesso";
}
