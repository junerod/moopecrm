import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CardDeSetup, EstadoDoCard } from "@/lib/negocio/estado";

const ROTULO: Record<EstadoDoCard, string> = {
  ok: "Configurado",
  falta: "Não configurado",
  atencao: "Precisa de atenção",
};

const TOM: Record<EstadoDoCard, string> = {
  ok: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  falta: "bg-muted text-muted-foreground",
  atencao: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
};

export function CardDeSetupNegocio({ card }: { card: CardDeSetup }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4" data-testid={`card-setup-${card.id}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{card.titulo}</h2>
        <span
          data-testid={`card-setup-${card.id}-estado`}
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM[card.estado]}`}
        >
          {ROTULO[card.estado]}
        </span>
      </div>
      <p className="flex-1 text-sm text-muted-foreground">{card.resumo}</p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={card.href}>Configurar</Link>
      </Button>
    </Card>
  );
}
