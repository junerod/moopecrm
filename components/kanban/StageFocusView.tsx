"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, X } from "@/lib/ui/icons";
import { bateBuscaDaEtapa } from "@/lib/kanban/stage-focus-busca";
import { buildCardInput } from "@/lib/kanban/card-state";
import type { Lead } from "@/lib/types/leads";
import type { Stage } from "@/lib/kanban/types";
import { KanbanCard } from "./KanbanCard";

interface StageFocusViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: Stage | null;
  leads: Lead[];
  pipelineId: string;
  stages: Stage[];
  ownerNames?: Map<string, string | null>;
  coolingIds?: Set<string>;
  reactivations?: Map<string, { proposalId: string; expiresAt: string }>;
  canonicalTags?: string[];
  selectedLeadIds?: Set<string>;
  pulses?: Map<string, number>;
  onSelect?: (leadId: string, additive: boolean) => void;
  onOpenLead?: (leadId: string) => void;
  funis?: Array<{ id: string; name: string }>;
}

/**
 * Etapa em tela cheia: coluna lotada deixa de ser um scroll vertical mini.
 * Cards reusam o mesmo menu (Mover para…) sem arrasto.
 */
export function StageFocusView({
  open,
  onOpenChange,
  stage,
  leads,
  pipelineId,
  stages,
  ownerNames,
  coolingIds,
  reactivations,
  canonicalTags,
  selectedLeadIds,
  pulses,
  onSelect,
  onOpenLead,
  funis,
}: StageFocusViewProps) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const filtrados = useMemo(
    () => leads.filter((l) => bateBuscaDaEtapa(l, q)),
    [leads, q],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setBusca("");
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 left-0 top-0 flex-col gap-0 rounded-none border-0 p-0 sm:rounded-none"
        data-testid="stage-focus-view"
        // O Dialog padrão põe um X absoluto; aqui o header tem "Voltar".
        // Escondemos o close default via CSS do filho sr-only já no componente.
      >
        <DialogHeader className="shrink-0 space-y-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="truncate text-lg font-semibold tracking-tight">
              {stage?.name ?? "Etapa"}
              <span className="ml-2 text-sm font-normal tabular-nums text-[var(--color-text-muted)]">
                {leads.length}
              </span>
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="stage-focus-voltar"
            >
              <X size={14} className="mr-1.5" />
              Voltar ao quadro
            </Button>
          </div>
          <div className="relative max-w-md">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nesta etapa…"
              className="h-9 pl-8"
              data-testid="stage-focus-busca"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg)] px-4 py-4 sm:px-6">
          {filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              {leads.length === 0
                ? "Nenhum card nesta etapa."
                : "Nenhum card bate com a busca."}
            </p>
          ) : (
            <ul className="mx-auto grid max-w-3xl gap-2">
              {filtrados.map((lead, idx) => (
                <li key={lead.id}>
                  <KanbanCard
                    card={buildCardInput(lead, {
                      stageName: stage?.name ?? "—",
                      ownerNames,
                      coolingIds,
                      reactivations,
                      canonicalTags,
                    })}
                    lead={lead}
                    index={idx}
                    pipelineId={pipelineId}
                    stages={stages}
                    isSelected={selectedLeadIds?.has(lead.id)}
                    pulseCount={pulses?.get(lead.id) ?? 0}
                    onSelect={onSelect}
                    onOpen={onOpenLead}
                    disableDrag
                    funis={funis}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
