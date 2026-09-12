"use client";

import { ESTILO_DO_TOM } from "@/lib/design-system/tones";
import { useMarcarPapel } from "@/hooks/inbox/useMarcarPapel";
import {
  PAPEIS_DO_CONTATO,
  ROTULO_DO_PAPEL,
  type PapelDoContato,
} from "@/lib/crm/papel-e-temperatura";
import { TOM_DO_PAPEL } from "@/lib/inbox/tom-da-tag";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";

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
          const cor = ESTILO_DO_TOM[TOM_DO_PAPEL[p]];
          return (
            <button
              key={p}
              type="button"
              className="h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 disabled:opacity-50"
              style={
                ativo
                  ? { background: cor.bg, color: cor.fg, borderColor: "transparent" }
                  : { background: "transparent", color: cor.fg, borderColor: cor.bg }
              }
              disabled={isPending}
              aria-pressed={ativo}
              data-testid={`chip-papel-${p}`}
              onClick={() =>
                void marcar(p, { atual: papel, contactName, summary, onAtualizou })
              }
            >
              {ROTULO_DO_PAPEL[p]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { PapelDoContato };
