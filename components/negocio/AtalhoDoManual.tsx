"use client";

import { AppIcon } from "@/components/ds/AppIcon";
import { LinkDoManual } from "@/components/manual/LinkDoManual";
import { BookOpen } from "@/lib/ui/icons";

export function AtalhoDoManual({
  capitulo = "modelos-prontos",
  titulo = "Como usar os modelos",
  texto = "Guia ilustrado: escolher, ativar e terminar os quatro passos.",
  testid = "loja-abrir-manual",
}: {
  capitulo?: string;
  titulo?: string;
  texto?: string;
  testid?: string;
}) {
  return (
    <LinkDoManual
      capitulo={capitulo}
      testid={testid}
      className="flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--moope-primary)_8%,var(--color-surface))] px-4 py-3 ring-1 ring-[color-mix(in_srgb,var(--moope-primary)_22%,var(--color-border))] transition-colors hover:bg-[color-mix(in_srgb,var(--moope-primary)_12%,var(--color-surface))]"
    >
      <AppIcon icon={BookOpen} tone="blue" size="lg" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight">{titulo}</span>
        <span className="mt-0.5 block text-sm leading-5 text-[var(--color-text-muted)]">{texto}</span>
      </span>
    </LinkDoManual>
  );
}
