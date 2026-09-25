"use client";
import { Droppable } from "@hello-pangea/dnd";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types/leads";
import type { Stage } from "@/lib/kanban/types";
import { buildCardInput } from "@/lib/kanban/card-state";
import { KanbanCard } from "./KanbanCard";
import { ESTILO_DO_TOM } from "@/lib/design-system/tones";
import { tomDaEtapa } from "@/lib/kanban/tom-da-etapa";
import { ArrowsOutSimple } from "@/lib/ui/icons";

interface StageColumnProps {
  stage: Stage;
  /** Índice na lista do funil — cor pastel sem persistir no banco. */
  stageIndex?: number;
  leads: Lead[];
  pipelineId: string;
  stages?: Stage[];
  /** owner_user_id → nome, resolvido no board. O dono agente vem no lead. */
  ownerNames?: Map<string, string | null>;
  /** ids que o radar classificou como esfriando (fonte única, não recalculada). */
  coolingIds?: Set<string>;
  /** Propostas de retomada vivas, por lead. */
  reactivations?: Map<string, { proposalId: string; expiresAt: string }>;
  /** `settings.canonical_tags` do pipeline — a única tag que fica no card. */
  canonicalTags?: string[];
  selectedLeadIds?: Set<string>;
  /** leadId → quantos eventos remotos já chegaram (muda = pulsa de novo). */
  pulses?: Map<string, number>;
  onSelect?: (leadId: string, additive: boolean) => void;
  /** Abrir o dossiê — atravessa o board até o card, como `pulses`. */
  onOpen?: (leadId: string) => void;
  /** Clique no título: abre a etapa em tela cheia. */
  onFocusStage?: (stageId: string) => void;
  funis?: Array<{ id: string; name: string }>;
}

function formatBRL(cents: number): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `R$ ${(cents / 100).toFixed(0)}`;
  }
}

export function StageColumn({
  stage,
  stageIndex = 0,
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
  onOpen,
  onFocusStage,
  funis,
}: StageColumnProps) {
  const totalCents = leads.reduce((sum, l) => sum + (l.value_cents ?? 0), 0);
  const tom = tomDaEtapa(stage, stageIndex);
  const cor = ESTILO_DO_TOM[tom];
  const accentStyle: CSSProperties = stage.color
    ? { backgroundColor: stage.color }
    : { backgroundColor: cor.fg };

  return (
    <div
      data-stage-column={stage.id}
      className="flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-[12px] ring-1 ring-[var(--color-border)]"
      style={{ background: cor.bg }}
    >
      <div className="sticky top-0 z-[1] flex shrink-0 items-center gap-2 border-b border-[var(--color-border)]/70 px-3 py-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={accentStyle}
          aria-hidden
        />
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]"
          onClick={() => onFocusStage?.(stage.id)}
          data-testid={`stage-title-${stage.id}`}
          title="Abrir etapa em tela cheia"
        >
          <h2 className="truncate text-sm font-semibold text-text group-hover:underline">
            {stage.name}
          </h2>
          <ArrowsOutSimple
            size={12}
            className="shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--color-text-muted)] outline-none hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]"
          onClick={() => onFocusStage?.(stage.id)}
          aria-label={`Abrir ${stage.name}: ${leads.length} cards`}
          data-testid={`stage-count-${stage.id}`}
        >
          {leads.length}
        </button>
      </div>

      {totalCents > 0 && (
        <div className="shrink-0 border-b border-[var(--color-border)]/70 px-3 py-1.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {formatBRL(totalCents)}
        </div>
      )}

      <Droppable droppableId={stage.id} type="LEAD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
              snapshot.isDraggingOver &&
                "bg-[var(--moope-primary-bg)] ring-1 ring-inset ring-[var(--moope-primary)]/30",
            )}
          >
            {leads.map((lead, idx) => (
              <KanbanCard
                key={lead.id}
                card={buildCardInput(lead, {
                  stageName: stage.name,
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
                onOpen={onOpen}
                funis={funis}
              />
            ))}
            {provided.placeholder}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex h-20 items-center justify-center text-[11px] text-text-muted/70">
                vazio
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
