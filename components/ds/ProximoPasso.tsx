import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Orientação contextual: uma ação claramente necessária, sem popup.
 * Reutilizado na Home (via checklist), Assistentes e telas vazias.
 */
export function ProximoPasso({
  titulo,
  texto,
  acao,
  href,
  testId = "proximo-passo",
}: {
  titulo: string;
  texto: string;
  acao: string;
  href: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
      <Button asChild size="sm">
        <Link href={href}>{acao}</Link>
      </Button>
    </div>
  );
}
