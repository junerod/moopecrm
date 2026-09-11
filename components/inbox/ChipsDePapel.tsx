"use client";

import { Button } from "@/components/ui/button";
import { useMarcarPapel } from "@/hooks/inbox/useMarcarPapel";
import {
  PAPEIS_DO_CONTATO,
  ROTULO_DO_PAPEL,
  type PapelDoContato,
} from "@/lib/crm/papel-e-temperatura";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";
import { cn } from "@/lib/utils";

interface Props {
  contactId: string;
  papel: string | null | undefined;
  contactName: string;
  summary: CrmSummaryData | null;
  onAtualizou: (papel?: PapelDoContato | null) => void;
}

export function ChipsDePapel({
  contactId,
  papel,
  contactName,
  summary,
  onAtualizou,
}: Props) {
  const { marcar, isPending } = useMarcarPapel(contactId);

  return (
    <div className="space-y-1" data-testid="chips-papel">
      <div className="text-xs text-muted-foreground">Papel</div>
      <div className="flex flex-wrap gap-1">
        {PAPEIS_DO_CONTATO.map((p) => {
          const ativo = papel === p;
          return (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={ativo ? "default" : "outline"}
              className={cn("h-6 px-2 text-[11px]", ativo && "pointer-events-auto")}
              disabled={isPending}
              aria-pressed={ativo}
              data-testid={`chip-papel-${p}`}
              onClick={() =>
                void marcar(p, { atual: papel, contactName, summary, onAtualizou })
              }
            >
              {ROTULO_DO_PAPEL[p]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export type { PapelDoContato };
